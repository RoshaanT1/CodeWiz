// Theme preference shared by the root layout and the theme toggle.

export const THEME_STORAGE_KEY = "codewiz-theme";

/** Runs before first paint and adds `.dark` when the saved theme is dark. */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;
