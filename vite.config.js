import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Necessário porque o site fica em usuario.github.io/teamonan/ (um
  // subcaminho), não na raiz do domínio. Se o nome do repositório for
  // outro, troque "teamonan" abaixo para bater com ele.
  base: "/teamonan/",
});
