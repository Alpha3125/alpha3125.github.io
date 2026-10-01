/* =====================================================
   SHARED FOOTER
   ===================================================== */

fetch("footer.html")
    .then(response => response.text())
    .then(data => {
        document.getElementById("footer").innerHTML = data;
        document.getElementById("year").textContent = new Date().getFullYear();
    });


/* =====================================================
   VORONOI INTRO
   ===================================================== */

const canvas = document.getElementById("introCanvas");
const ctx = canvas?.getContext("2d");
const backgroundCanvas = document.getElementById("backgroundCanvas");
const backgroundCtx = backgroundCanvas?.getContext("2d");
const page = document.documentElement;

const introNavigation = sessionStorage.getItem("introNavigation");
if (introNavigation === "skip") {
    page.classList.add("no-intro");
}
sessionStorage.removeItem("introNavigation");
document.querySelectorAll("[data-intro]").forEach(link => {
    link.addEventListener("click", () => {
        sessionStorage.setItem(
            "introNavigation",
            link.dataset.intro === "skip" ? "skip" : "replay"
        );
    });
});

const runIntro = !!canvas && !!ctx && !page.classList.contains("no-intro");

if (!backgroundCanvas || !backgroundCtx) {
    page.classList.add("intro-complete");
} else {
    if (runIntro) page.classList.add("intro-active");

    let width = 0;
    let height = 0;
    let devicePixelRatio = 1;
    let sites = [];
    let voronoiEdges = [];
    let resizeFrame;

    const SITE_COUNT = 24;
    const DISC_RADIUS_RATIO = 0.23;
    const MIN_SITE_DISTANCE = 34;
    const VIEWPORT_INSET = 1;
    const PATTERN_STORAGE_KEY = "voronoiPatternV1";

    const DOT_TIME = 1050;
    const ROUTE_TIME = 1250;
    const FADE_TIME = 600;

    const LINE_WIDTH = 1.5;
    const POINT_RADIUS = 4;
    const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    function random(min, max) {
        return min + Math.random() * (max - min);
    }

    function clamp(value, min = 0, max = 1) {
        return Math.min(Math.max(value, min), max);
    }

    function distance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function interpolate(a, b, amount) {
        return {
            x: a.x + (b.x - a.x) * amount,
            y: a.y + (b.y - a.y) * amount
        };
    }

    function accelerate(progress) {
        return Math.pow(progress, 2.2);
    }

    function easeOutBack(progress) {
        const overshoot = 1.45;
        const shifted = progress - 1;

        return 1
            + (overshoot + 1) * Math.pow(shifted, 3)
            + overshoot * Math.pow(shifted, 2);
    }

    function resizeCanvasElement(element, context) {
        if (!element || !context) {
            return;
        }

        element.width = Math.round(width * devicePixelRatio);
        element.height = Math.round(height * devicePixelRatio);
        element.style.width = `${width}px`;
        element.style.height = `${height}px`;
        context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }

    function resizeCanvases() {
        devicePixelRatio = window.devicePixelRatio || 1;
        width = window.innerWidth;
        height = window.innerHeight;

        resizeCanvasElement(canvas, ctx);
        resizeCanvasElement(backgroundCanvas, backgroundCtx);
    }

    /* -------------------------------------------------
       RANDOM SITES IN A DISC
       ------------------------------------------------- */

    function createSites() {
        const centre = { x: width / 2, y: height / 2 };
        const radius = Math.min(width, height) * DISC_RADIUS_RATIO;
        const generatedSites = [];
        let attempts = 0;

        function makeSite() {
            const angle = random(0, Math.PI * 2);
            const distanceFromCentre = radius * Math.sqrt(Math.random());

            return {
                x: centre.x + Math.cos(angle) * distanceFromCentre,
                y: centre.y + Math.sin(angle) * distanceFromCentre,
                entranceDelay: random(40, 300)
            };
        }

        while (generatedSites.length < SITE_COUNT && attempts < SITE_COUNT * 300) {
            attempts += 1;
            const site = makeSite();

            if (generatedSites.every(other => distance(site, other) >= MIN_SITE_DISTANCE)) {
                generatedSites.push(site);
            }
        }

        // A small viewport can make the separation rule impossible to satisfy.
        // Fill any remaining places rather than leaving the network incomplete.
        while (generatedSites.length < SITE_COUNT) {
            generatedSites.push(makeSite());
        }

        return generatedSites;
    }

    function saveSites() {
    const scale = Math.min(width, height);
    localStorage.setItem(PATTERN_STORAGE_KEY, JSON.stringify(
        sites.map(site => ({
            x: (site.x - width / 2) / scale,
            y: (site.y - height / 2) / scale,
            entranceDelay: site.entranceDelay
        }))
    ));
}

    function loadSites() {
        try {
            const saved = JSON.parse(localStorage.getItem(PATTERN_STORAGE_KEY));
            if (!Array.isArray(saved) || saved.length !== SITE_COUNT) return false;

            const scale = Math.min(width, height);
            sites = saved.map(site => ({
                x: width / 2 + site.x * scale,
                y: height / 2 + site.y * scale,
                entranceDelay: site.entranceDelay
            }));

            return true;
        } catch {
            return false;
        }
    }

    /* -------------------------------------------------
       VORONOI CONSTRUCTION

       Each cell starts as the viewport and is clipped by
       the perpendicular bisector for every other site.
       ------------------------------------------------- */

    function clipCellToSite(cell, site, otherSite) {
        if (cell.length === 0) {
            return cell;
        }

        const midpoint = {
            x: (site.x + otherSite.x) / 2,
            y: (site.y + otherSite.y) / 2
        };
        const normal = {
            x: otherSite.x - site.x,
            y: otherSite.y - site.y
        };
        const signedDistance = point => (
            (point.x - midpoint.x) * normal.x
            + (point.y - midpoint.y) * normal.y
        );
        const clipped = [];

        let previous = cell[cell.length - 1];
        let previousDistance = signedDistance(previous);

        for (const current of cell) {
            const currentDistance = signedDistance(current);
            const previousInside = previousDistance <= 0;
            const currentInside = currentDistance <= 0;

            if (previousInside !== currentInside) {
                const ratio = previousDistance / (previousDistance - currentDistance);
                clipped.push(interpolate(previous, current, ratio));
            }

            if (currentInside) {
                clipped.push(current);
            }

            previous = current;
            previousDistance = currentDistance;
        }

        return clipped;
    }

    function buildVoronoiCells(currentSites) {
        const bounds = [
            { x: VIEWPORT_INSET, y: VIEWPORT_INSET },
            { x: width - VIEWPORT_INSET, y: VIEWPORT_INSET },
            { x: width - VIEWPORT_INSET, y: height - VIEWPORT_INSET },
            { x: VIEWPORT_INSET, y: height - VIEWPORT_INSET }
        ];

        return currentSites.map(site => {
            let cell = bounds.map(point => ({ ...point }));

            for (const otherSite of currentSites) {
                if (site !== otherSite) {
                    cell = clipCellToSite(cell, site, otherSite);
                }

                if (cell.length === 0) {
                    break;
                }
            }

            return cell;
        });
    }

    function edgeKey(a, b) {
        const precision = 10;
        const pointKey = point => (
            `${Math.round(point.x * precision)},${Math.round(point.y * precision)}`
        );
        const first = pointKey(a);
        const second = pointKey(b);

        return first < second ? `${first}|${second}` : `${second}|${first}`;
    }

    function isOnViewportBoundary(point) {
        const tolerance = 1.5;

        return (
            point.x <= VIEWPORT_INSET + tolerance
            || point.x >= width - VIEWPORT_INSET - tolerance
            || point.y <= VIEWPORT_INSET + tolerance
            || point.y >= height - VIEWPORT_INSET - tolerance
        );
    }

    function extractVoronoiEdges(cells) {
        const foundEdges = new Map();

        for (const cell of cells) {
            for (let index = 0; index < cell.length; index += 1) {
                const a = cell[index];
                const b = cell[(index + 1) % cell.length];

                if (distance(a, b) < 2) {
                    continue;
                }

                const key = edgeKey(a, b);
                const previous = foundEdges.get(key);

                if (previous) {
                    previous.count += 1;
                } else {
                    foundEdges.set(key, {
                        a: { ...a },
                        b: { ...b },
                        count: 1
                    });
                }
            }
        }

        return [...foundEdges.values()]
            // A cell edge that belongs to one cell is just the artificial
            // viewport border. A real Voronoi edge is shared by two cells.
            .filter(edge => edge.count >= 2)
            .map(edge => {
                const aOnBoundary = isOnViewportBoundary(edge.a);
                const bOnBoundary = isOnViewportBoundary(edge.b);

                if (aOnBoundary && bOnBoundary) {
                    return null;
                }

                const centre = { x: width / 2, y: height / 2 };
                const vertices = [edge.a, edge.b].filter(
                    point => !isOnViewportBoundary(point)
                );
                const nearestVertexDistance = Math.min(
                    ...vertices.map(point => distance(point, centre))
                );
                const radialDelay = clamp(
                    nearestVertexDistance / (Math.min(width, height) * 0.52)
                ) * 0.32;
                const boundaryDelay = aOnBoundary || bOnBoundary ? 0.1 : 0;

                return {
                    ...edge,
                    // Resolve the central junctions before sending edges outward.
                    delay: Math.min(
                        radialDelay + boundaryDelay + random(0, 0.06),
                        0.65
                    ),
                    direction: aOnBoundary || bOnBoundary ? "outward" : "both"
                };
            })
            .filter(Boolean);
    }

    function generatePattern() {
        if (!loadSites()) {
            sites = createSites();
            saveSites();
        }

        const cells = buildVoronoiCells(sites);
        voronoiEdges = extractVoronoiEdges(cells);
    }

    /* -------------------------------------------------
       DRAWING
       ------------------------------------------------- */

    function strokeSegment(context, a, b, opacity) {
        if (opacity <= 0 || distance(a, b) < 0.5) {
            return;
        }

        // The leading end of each growing edge becomes progressively lighter.
        // It replaces the previous two-stroke, outlined treatment.
        const alphaGradient = context.createLinearGradient(a.x, a.y, b.x, b.y);
        alphaGradient.addColorStop(0, `rgba(34, 34, 34, ${opacity})`);
        alphaGradient.addColorStop(1, `rgba(34, 34, 34, ${opacity * 0.18})`);

        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.lineWidth = LINE_WIDTH;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.strokeStyle = alphaGradient;
        context.stroke();
    }

    function drawVoronoiEdge(edge, progress, opacity) {
        const localProgress = clamp(
            (progress - edge.delay) / (1 - edge.delay)
        );

        if (localProgress <= 0) {
            return;
        }

        const growth = accelerate(localProgress);

        if (edge.direction === "both") {
            // Edges that connect two Voronoi vertices grow from both junctions.
            strokeSegment(ctx, edge.a, interpolate(edge.a, edge.b, growth / 2), opacity);
            strokeSegment(ctx, edge.b, interpolate(edge.b, edge.a, growth / 2), opacity);
            return;
        }

        // A clipped, unbounded Voronoi edge grows from its interior vertex
        // toward the edge of the viewport.
        const origin = isOnViewportBoundary(edge.a) ? edge.b : edge.a;
        const destination = origin === edge.a ? edge.b : edge.a;
        strokeSegment(ctx, origin, interpolate(origin, destination, growth), opacity);
    }

    function drawSite(site, elapsed, fadeProgress) {
        const appearanceProgress = clamp(
            (elapsed - site.entranceDelay) / 740
        );
        const sproutProgress = easeOutBack(appearanceProgress);
        const radius = POINT_RADIUS * sproutProgress;
        const fadeOut = 1 - clamp((fadeProgress - 0.8) / 0.2);
        const opacity = 0.78 * clamp(appearanceProgress * 3) * fadeOut;

        if (radius <= 0 || opacity <= 0) {
            return;
        }

        ctx.beginPath();
        ctx.arc(site.x, site.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34, 34, 34, ${opacity})`;
        ctx.fill();
    }

    function drawBackground() {
        if (!backgroundCtx) {
            return;
        }

        backgroundCtx.clearRect(0, 0, width, height);
        backgroundCtx.lineWidth = 1;
        backgroundCtx.lineCap = "round";
        backgroundCtx.lineJoin = "round";
        backgroundCtx.strokeStyle = "rgba(17, 17, 17, 0.07)";

        for (const edge of voronoiEdges) {
            backgroundCtx.beginPath();
            backgroundCtx.moveTo(edge.a.x, edge.a.y);
            backgroundCtx.lineTo(edge.b.x, edge.b.y);
            backgroundCtx.stroke();
        }
    }

    /* -------------------------------------------------
       ANIMATION
       ------------------------------------------------- */

    let introFinished = false;
    const startTime = performance.now();

    function finishIntro() {
        if (introFinished) {
            return;
        }

        introFinished = true;
        canvas.classList.add("is-fading");
        window.removeEventListener("resize", handleResize);
        drawBackground();
        window.addEventListener("resize", handleBackgroundResize);
        page.classList.add("intro-transition");

        window.setTimeout(() => {
            canvas.remove();
            page.classList.remove("intro-active");
            page.classList.remove("intro-transition");
            page.classList.add("intro-complete");
        }, prefersReducedMotion ? 1 : FADE_TIME);
    }

    function animate(now) {
        const elapsed = now - startTime;
        const routeElapsed = Math.max(0, elapsed - DOT_TIME);
        const routeProgress = clamp(routeElapsed / ROUTE_TIME);
        const lineOpacity = 0.5;

        ctx.clearRect(0, 0, width, height);

        for (const site of sites) {
            drawSite(site, elapsed, routeProgress);
        }

        for (const edge of voronoiEdges) {
            drawVoronoiEdge(edge, routeProgress, lineOpacity);
        }

        if (routeProgress >= 1) {
            finishIntro();
            return;
        }

        requestAnimationFrame(animate);
    }

    function handleResize() {
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(() => {
            resizeCanvases();
            generatePattern();
        });
    }

    function handleBackgroundResize() {
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(() => {
            resizeCanvases();
            generatePattern();
            drawBackground();
        });
    }

    resizeCanvases();
    generatePattern();

    if (runIntro) {
        window.addEventListener("resize", handleResize);

        if (prefersReducedMotion) {
            finishIntro();
        } else {
            requestAnimationFrame(animate);
        }
    } else {
        drawBackground();
        page.classList.add("intro-complete");
        window.addEventListener("resize", handleBackgroundResize);
    }
}
