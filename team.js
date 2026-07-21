const API =
    "https://script.google.com/u/0/home/projects/1UmcjzjF2VitfaK80rbe7SEDCCrEf7fhXiM3m01mG9zOUaMnbrBUAF9KW";

async function loadMembers() {
    const response = await fetch(API);
    const members = await response.json();

    console.log(members);
}

loadMembers();