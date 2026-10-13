// Trava a rolagem da página enquanto houver algum painel aberto.
// Com contador: dois painéis sobrepostos (ex.: formulário fechando enquanto o livro abre)
// não deixam a página presa ao restaurarem estados um do outro.
let locks = 0;

export function lockScroll() {
  locks++;
  document.documentElement.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) document.documentElement.style.overflow = "";
  };
}
