const $ = (id) => document.getElementById(id);

const out = $("output");
const setOut = (v) => {
  out.textContent = typeof v === "string" ? v : JSON.stringify(v, null, 2);
};

function commonInput() {
  return {
    vaultPath: $("vaultPath").value.trim(),
    passphrase: $("passphrase").value
  };
}

async function run(action, payload) {
  setOut("Running...");
  const res = await window.bpvpWallet[action](payload);
  if (!res?.ok) {
    setOut(`ERROR: ${res?.error || "unknown error"}`);
    return;
  }
  setOut(res.data);
}

$("btnInit").addEventListener("click", async () => {
  await run("init", {
    ...commonInput(),
    network: $("network").value
  });
});

$("btnCreate").addEventListener("click", async () => {
  await run("createSeed", {
    ...commonInput(),
    returnMnemonic: $("showMnemonic").checked
  });
});

$("btnDerive").addEventListener("click", async () => {
  await run("derive", {
    ...commonInput(),
    index: Number($("index").value || "0")
  });
});

$("btnSign").addEventListener("click", async () => {
  await run("signMessage", {
    ...commonInput(),
    index: Number($("index").value || "0"),
    message: $("message").value
  });
});

$("btnStatus").addEventListener("click", async () => {
  await run("status", {
    vaultPath: $("vaultPath").value.trim()
  });
});
