import { useEffect, useState } from "react";
import { DSButton } from "@/components/design-system/DSButton";
import { supabase } from "@/integrations/supabase/client";
import { verifyAdminSSOFromURL } from "@/lib/admin.sso";
import { useToast } from "@/hooks/use-toast";
import { LogIn } from "lucide-react";

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [loginAsLoading, setLoginAsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      const { ok } = await verifyAdminSSOFromURL();
      if (!ok) {
        window.location.href = "/";
        return;
      }
      await loadUsers();
    };
    init();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-users-list");
      
      if (error) throw error;
      setUsers(data?.users || []);
    } catch (error) {
      console.error("Load users error:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserDetails = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-users-list", {
        body: { user_id: userId }
      });
      
      if (error) throw error;
      
      setSelectedUser({
        ...data.user,
        applications: data.applications || [],
        favorites: data.favorites || []
      });
    } catch (error) {
      console.error("Load user details error:", error);
    }
  };

  const handleLoginAsStudent = async (userEmail: string, userId: string) => {
    setLoginAsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-login-as-student", {
        body: { user_email: userEmail, user_id: userId }
      });

      if (error) throw error;

      if (data?.login_url) {
        toast({
          title: "Opening student portal...",
          description: "You will be logged in as this student."
        });
        
        // Open in new tab
        window.open(data.login_url, "_blank");
      }
    } catch (error) {
      console.error("Login as student error:", error);
      toast({
        title: "Error",
        description: "Failed to generate login link.",
        variant: "destructive"
      });
    } finally {
      setLoginAsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-12">Loading...</div>
    );
  }

  return (
    <>
      <section className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Users Management</h1>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Users List */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border bg-background overflow-hidden">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-semibold">Name</th>
                    <th className="text-left p-3 font-semibold">Email</th>
                    <th className="text-left p-3 font-semibold">Phone</th>
                    <th className="text-left p-3 font-semibold">Joined</th>
                    <th className="text-left p-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id} className="border-b hover:bg-muted/50">
                      <td className="p-3">{u.full_name || "—"}</td>
                      <td className="p-3">{u.email || "—"}</td>
                      <td className="p-3">{u.phone || "—"}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <DSButton
                            variant="outline"
                            size="sm"
                            onClick={() => loadUserDetails(u.user_id)}
                          >
                            View
                          </DSButton>
                          <DSButton
                            variant="primary"
                            size="sm"
                            onClick={() => handleLoginAsStudent(u.email, u.user_id)}
                            disabled={loginAsLoading}
                          >
                            <LogIn className="h-4 w-4 mr-1" />
                            Login As
                          </DSButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* User Details Panel */}
          <div className="lg:col-span-1">
            {selectedUser ? (
              <div className="rounded-xl border bg-background p-4 space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">{selectedUser.full_name}</h3>
                  <div className="text-sm space-y-1">
                    <div className="text-muted-foreground">Email: {selectedUser.email}</div>
                    <div className="text-muted-foreground">Phone: {selectedUser.phone || "—"}</div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">
                    Applications ({selectedUser.applications?.length || 0})
                  </div>
                  {selectedUser.applications?.slice(0, 5).map((app: any) => (
                    <div key={app.id} className="text-xs text-muted-foreground mb-1">
                      • {app.status} - {new Date(app.created_at).toLocaleDateString()}
                    </div>
                  ))}
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">
                    Favorites ({selectedUser.favorites?.length || 0})
                  </div>
                  {selectedUser.favorites?.slice(0, 5).map((fav: any) => (
                    <div key={fav.program_id} className="text-xs text-muted-foreground mb-1">
                      • {fav.programs?.title}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <DSButton
                    variant="primary"
                    size="sm"
                    onClick={() => handleLoginAsStudent(selectedUser.email, selectedUser.user_id)}
                    disabled={loginAsLoading}
                    className="flex-1"
                  >
                    <LogIn className="h-4 w-4 mr-1" />
                    Login As Student
                  </DSButton>
                  <DSButton
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedUser(null)}
                    className="flex-1"
                  >
                    Close
                  </DSButton>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border bg-muted/50 p-8 text-center text-sm text-muted-foreground">
                Select a user to view details
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
