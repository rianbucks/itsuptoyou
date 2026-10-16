import { loadFigureHeader, readFigureIds } from "../engine/figure-loader.js";
import { watchVisibility } from "./game.js";
import { renderTitle } from "./screens/title.js";
import { store } from "./store.js";

async function boot() {
  try {
    const ids = await readFigureIds();
    store.figureHeaders = await Promise.all(ids.map((id) => loadFigureHeader(id)));
    watchVisibility();
    renderTitle();
  } catch (error) {
    document.getElementById("app").textContent = `데이터를 불러오지 못했다: ${error.message}`;
  }
}

boot();
