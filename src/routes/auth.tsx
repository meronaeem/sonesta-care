import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Server, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adLogin, getAdLoginMode } from "@/lib/ad.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In • Hotel IT Ops" },
      { name: "description", content: "Sign in to the Hotel IT Operations Management System." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [adUser, setAdUser] = useState("");
  const [adPass, setAdPass] = useState("");
  const [adLoading, setAdLoading] = useState(false);

  const adModeFn = useServerFn(getAdLoginMode);
  const adLoginFn = useServerFn(adLogin);
  const adMode = useQuery({ queryKey: ["ad-login-mode"], queryFn: () => adModeFn({}) });
  const adEnabled = Boolean(adMode.data?.adEnabled);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Signed in");
    navigate({ to: "/dashboard" });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — signing you in…");
    navigate({ to: "/dashboard" });
  };

  const signInWithAd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdLoading(true);
    try {
      const res = await adLoginFn({ data: { username: adUser, password: adPass } });
      const { error } = await supabase.auth.signInWithPassword({ email: res.email, password: res.oneTime });
      if (error) throw new Error(error.message);
      toast.success(`Welcome, ${res.displayName}`);
      setAdPass("");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Active Directory sign-in failed");
    } finally {
      setAdLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Server className="h-6 w-6 text-primary" />
          Hotel IT Operations
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Enterprise IT command center for hospitality.</h1>
          <p className="text-sidebar-foreground/70 max-w-md">
            Assets, tickets, licenses, network and servers — one operational surface for your entire property.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© {new Date().getFullYear()} Hotel IT Ops</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in with your work account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={adEnabled ? "ad" : "signin"}>
              <TabsList className={`grid w-full ${adEnabled ? "grid-cols-3" : "grid-cols-2"}`}>
                {adEnabled && <TabsTrigger value="ad">Active Directory</TabsTrigger>}
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              {adEnabled && (
                <TabsContent value="ad">
                  <form onSubmit={signInWithAd} className="space-y-4 pt-4">
                    <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span>Use your domain account{adMode.data?.domain ? ` for ${adMode.data.domain}` : ""}. Your password is verified by the domain controller and never stored here.</span>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adUser">Domain username</Label>
                      <Input id="adUser" required autoComplete="username" placeholder="jdoe" value={adUser} onChange={(e) => setAdUser(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adPass">Password</Label>
                      <Input id="adPass" type="password" required autoComplete="current-password" value={adPass} onChange={(e) => setAdPass(e.target.value)} />
                    </div>
                    <Button className="w-full" disabled={adLoading}>{adLoading ? "Verifying with Active Directory…" : "Sign in with Active Directory"}</Button>
                  </form>
                </TabsContent>
              )}
              <TabsContent value="signin">
                <form onSubmit={signIn} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button className="w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={signUp} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email2">Email</Label>
                    <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password2">Password</Label>
                    <Input id="password2" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button className="w-full" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
                  <p className="text-xs text-muted-foreground">First account is granted Administrator role automatically. Later users default to Employee.</p>
                </form>
              </TabsContent>
            </Tabs>
            <p className="text-xs text-muted-foreground text-center mt-6">
              <Link to="/" className="hover:underline">Back to home</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}