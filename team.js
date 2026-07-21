const API =
    "https://script.google.com/macros/s/AKfycbxmWEsq3epM3h9MI_v3G9Cy451z-0wts3zcwoZf_gHpSyqmR6L4A3LujdzmLGpzOqq5/exec";

async function loadMembers() {
    const response = await fetch(API);
    const members = await response.json();

    console.log(members);
}

loadMembers();