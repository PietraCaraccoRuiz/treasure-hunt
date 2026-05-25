export default function saveState(state) {
  try {
    localStorage.setItem("cacaPokebolas_v1", JSON.stringify(state));
  } catch {
    // Ignore storage errors from private mode or blocked localStorage.
  }
}
