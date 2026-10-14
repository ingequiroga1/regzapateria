import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { guardarHoja, listarCatalogo, listarVentas, obtenerHoja, registrarVenta, type Venta } from "@/lib/ventas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/ventas")({
  head: () => ({
    meta: [
      { title: "Ventas · Zapatería POS" },
      { name: "description", content: "Registra y consulta las ventas de la zapatería." },
      { property: "og:title", content: "Ventas · Zapatería POS" },
      { property: "og:description", content: "Registro de ventas conectado a Google Sheets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Ventas,
});

const inicial = { cliente: "", modelo: "", talla: "", color: "", cantidad: 1, precio: 0, metodoPago: "Efectivo" };
const dinero = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n) || 0);

function Ventas() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const registrar = useServerFn(registrarVenta);
  const listar = useServerFn(listarVentas);
  const catalogoFn = useServerFn(listarCatalogo);
  const [form, setForm] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [ventas, setVentas] = useState<Venta[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [catalogo, setCatalogo] = useState<string[]>([]);
  const obtenerHojaFn = useServerFn(obtenerHoja);
  const guardarHojaFn = useServerFn(guardarHoja);
  const [hojaId, setHojaId] = useState<string | null | undefined>(undefined);
  const [hojaInput, setHojaInput] = useState("");

  function cargarCatalogo() {
    catalogoFn()
      .then(setCatalogo)
      .catch((err) => toast.error(`No se pudo cargar el catálogo: ${(err as Error).message}`));
  }

  useEffect(() => {
    obtenerHojaFn()
      .then((id) => {
        setHojaId(id);
        if (id) cargarCatalogo();
      })
      .catch((err) => toast.error((err as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function asignarHoja(e: React.FormEvent) {
    e.preventDefault();
    try {
      const id = await guardarHojaFn({ data: { valor: hojaInput } });
      setHojaId(id);
      setHojaInput("");
      setVentas(null);
      toast.success("Google Sheet asignado a tu cuenta");
      cargarCatalogo();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const set = (k: keyof typeof inicial, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      const v = await registrar({ data: { ...form, cantidad: Number(form.cantidad), precio: Number(form.precio) } });
      toast.success(`Venta registrada: ${dinero(v.total)}`);
      setForm(inicial);
      if (ventas) setVentas([v, ...ventas]);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function cargar() {
    setCargando(true);
    try {
      const data = await listar();
      setVentas([...data].reverse());
      toast.success(`${data.length} registros cargados`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  async function salir() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const totalDia = (ventas ?? []).reduce((s, v) => s + Number(v.total || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold text-primary">Zapatería POS</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{user.email}</span>
            <Button variant="outline" size="sm" onClick={salir}>Salir</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 pt-6">
        <form onSubmit={asignarHoja} className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="min-w-[260px] flex-1 space-y-1.5">
            <Label>Google Sheet de tu cuenta</Label>
            <Input value={hojaInput} onChange={(e) => setHojaInput(e.target.value)}
              placeholder={hojaId ? `Actual: ${hojaId}` : "Pega aquí el enlace de tu Google Sheet"} />
          </div>
          <Button type="submit" variant="outline">{hojaId ? "Cambiar archivo" : "Asignar archivo"}</Button>
          {hojaId === null && <p className="w-full text-sm text-destructive">Asigna un Google Sheet para poder registrar y cargar ventas.</p>}
        </form>
      </div>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[360px_1fr]">
        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Nueva venta</h2>
          <form onSubmit={guardar} className="mt-4 space-y-3">
            <Campo label="Cliente"><Input value={form.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder="Opcional" /></Campo>
            <Campo label="Modelo">
              <Select value={form.modelo} onValueChange={(v) => set("modelo", v)} required>
                <SelectTrigger><SelectValue placeholder={catalogo.length ? "Elige un modelo" : "Catálogo vacío o no cargado"} /></SelectTrigger>
                <SelectContent>
                  {catalogo.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Talla"><Input required value={form.talla} onChange={(e) => set("talla", e.target.value)} placeholder="26.5" /></Campo>
              <Campo label="Color"><Input value={form.color} onChange={(e) => set("color", e.target.value)} /></Campo>
              <Campo label="Cantidad"><Input type="number" min={1} required value={form.cantidad} onChange={(e) => set("cantidad", e.target.value)} /></Campo>
              <Campo label="Precio unitario"><Input type="number" min={0} step="0.01" required value={form.precio} onChange={(e) => set("precio", e.target.value)} /></Campo>
            </div>
            <Campo label="Método de pago">
              <Select value={form.metodoPago} onValueChange={(v) => set("metodoPago", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Efectivo", "Tarjeta", "Transferencia"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </Campo>
            <div className="flex items-center justify-between rounded-md bg-accent px-3 py-2">
              <span className="text-sm">Total</span>
              <span className="text-lg font-bold">{dinero(Number(form.cantidad) * Number(form.precio))}</span>
            </div>
            <Button type="submit" className="w-full" disabled={guardando}>{guardando ? "Guardando..." : "Registrar venta"}</Button>
          </form>
        </section>

        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Registros de ventas</h2>
              {ventas && <p className="text-sm text-muted-foreground">{ventas.length} ventas · {dinero(totalDia)}</p>}
            </div>
            <Button variant="secondary" onClick={cargar} disabled={cargando}>{cargando ? "Cargando..." : "Cargar desde Google Sheet"}</Button>
          </div>
          <div className="mt-4 overflow-x-auto">
            {ventas === null ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Pulsa “Cargar desde Google Sheet” para ver las ventas.</p>
            ) : ventas.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No hay ventas registradas.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead><TableHead>Modelo</TableHead><TableHead>Talla</TableHead>
                    <TableHead>Color</TableHead><TableHead>Cant.</TableHead><TableHead>Pago</TableHead>
                    <TableHead>Cliente</TableHead><TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ventas.map((v, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">{v.fecha ? new Date(v.fecha).toLocaleString("es-MX") : ""}</TableCell>
                      <TableCell>{v.modelo}</TableCell><TableCell>{v.talla}</TableCell><TableCell>{v.color}</TableCell>
                      <TableCell>{v.cantidad}</TableCell><TableCell>{v.metodoPago}</TableCell><TableCell>{v.cliente}</TableCell>
                      <TableCell className="text-right font-medium">{dinero(v.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
