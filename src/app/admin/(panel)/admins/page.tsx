import Link from "next/link";
import { listAdmins } from "../poll-data";
import { currentAdminEmail } from "./admin-actions";
import { AdminsManager } from "@/components/admin/AdminsManager";

/**
 * Admins management — /admin/admins
 *
 * Lists allowlisted admins and lets any admin add/remove emails. RLS gates the
 * underlying admins table to is_admin(); the UI adds confirm-on-remove and a
 * self-removal warning, and the server blocks removing the last admin.
 */

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const [admins, currentEmail] = await Promise.all([
    listAdmins(),
    currentAdminEmail(),
  ]);

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <Link href="/admin" className="text-small text-text-dim hover:text-text">
          ← Votaciones
        </Link>
        <h1 className="mt-2 font-display text-h1 font-extrabold text-text">
          Administradores
        </h1>
        <p className="mt-1 text-small text-text-dim">
          Cualquier persona en esta lista puede gestionar votaciones.
        </p>
      </div>
      <AdminsManager admins={admins} currentEmail={currentEmail} />
    </div>
  );
}
