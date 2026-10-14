import { describe, it, expect } from "vitest";
import { extraerIdHoja } from "./hoja-id";

describe("extraerIdHoja", () => {
  it("saca el ID de un enlace", () => {
    expect(extraerIdHoja("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit#gid=0")).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz012345");
  });
  it("acepta un ID directo", () => {
    expect(extraerIdHoja("1AbCdEfGhIjKlMnOpQrStUvWxYz012345")).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz012345");
  });
  it("rechaza texto inválido", () => {
    expect(extraerIdHoja("hola")).toBeNull();
  });
});
