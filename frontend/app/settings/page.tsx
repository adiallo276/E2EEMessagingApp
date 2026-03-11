"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import ThemeToggle from "@/components/ui/theme-toggle";
import { api, apiUpload, profilePictureUrl } from "@/lib/api";
import { resizeImage } from "@/lib/image-utils";
import { 
  ArrowLeft, 
  User, 
  Camera, 
  Shield, 
  KeyRound, 
  Trash2, 
  LogOut,
  Check,
  AlertCircle,
  Loader2
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState("");
  const [avatarKey, setAvatarKey] = useState(0);
  
  // Profile picture state
  const [uploadingPic, setUploadingPic] = useState(false);
  const picInputRef = useRef<HTMLInputElement>(null);
  
  // Username change state
  const [newUsername, setNewUsername] = useState("");
  const [changingUsername, setChangingUsername] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Delete account state
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  
  // Messages
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    
    const token = localStorage.getItem("token");
    const u = localStorage.getItem("username") || "";
    
    if (!token) {
      router.replace("/login");
      return;
    }
    
    setUsername(u);
    setNewUsername(u);
  }, [router]);

  if (!mounted) return null;

  function showSuccess(msg: string) {
    setSuccessMessage(msg);
    setErrorMessage(null);
    setTimeout(() => setSuccessMessage(null), 4000);
  }

  function showError(msg: string) {
    setErrorMessage(msg);
    setSuccessMessage(null);
    setTimeout(() => setErrorMessage(null), 4000);
  }

  async function handleProfilePicUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showError("Please select an image file");
      return;
    }

    setUploadingPic(true);

    try {
      const resized = await resizeImage(file, 256);
      await apiUpload("/users/me/profile-picture", resized);
      setAvatarKey((k) => k + 1);
      showSuccess("Profile picture updated!");
    } catch (err: any) {
      showError(err?.message || "Failed to upload profile picture");
    } finally {
      setUploadingPic(false);
      if (picInputRef.current) picInputRef.current.value = "";
    }
  }

  async function handleChangeUsername() {
    const trimmed = newUsername.trim();
    if (!trimmed || trimmed === username) return;

    setChangingUsername(true);

    try {
      const response = await api("/users/me/username", {
        method: "PUT",
        body: JSON.stringify({ username: trimmed }),
      });
      
      // Update both username and token in localStorage
      if (response && response.token) {
        localStorage.setItem("token", response.token);
      }
      localStorage.setItem("username", trimmed);
      setUsername(trimmed);
      showSuccess("Username changed successfully!");
    } catch (err: any) {
      showError(err?.message || "Failed to change username");
    } finally {
      setChangingUsername(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword) {
      showError("Please fill in all password fields");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      showError("New passwords don't match");
      return;
    }
    
    if (newPassword.length < 4) {
      showError("Password must be at least 4 characters");
      return;
    }

    setChangingPassword(true);

    try {
      await api("/users/me/password", {
        method: "PUT",
        body: JSON.stringify({ 
          currentPassword, 
          newPassword 
        }),
      });
      
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showSuccess("Password changed successfully!");
    } catch (err: any) {
      showError(err?.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== username) {
      showError("Please type your username to confirm");
      return;
    }

    setDeletingAccount(true);

    try {
      await api("/users/me", {
        method: "DELETE",
      });
      
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      router.replace("/login");
    } catch (err: any) {
      showError(err?.message || "Failed to delete account");
      setDeletingAccount(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Background gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={picInputRef}
        onChange={handleProfilePicUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Header */}
      <div className="mx-auto max-w-2xl px-6 py-6">
        <div className="flex items-center justify-between">
          <Link 
            href="/conversations" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to chats
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-6 pb-12">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
        </div>

        {/* Success/Error messages */}
        {successMessage && (
          <div className="mb-6 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm flex items-center gap-2 text-primary">
            <Check className="h-4 w-4" />
            {successMessage}
          </div>
        )}
        
        {errorMessage && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            {errorMessage}
          </div>
        )}

        <div className="space-y-6">
          {/* Profile Picture Section */}
          <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="p-5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
              <h2 className="font-semibold flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" />
                Profile Picture
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">Update your profile photo</p>
            </div>
            
            <div className="p-5">
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <Avatar className="h-20 w-20 border-2 border-border">
                    {username && (
                      <AvatarImage
                        key={avatarKey}
                        src={profilePictureUrl(username)}
                        alt={username}
                      />
                    )}
                    <AvatarFallback className="bg-primary/20 text-xl font-bold text-primary">
                      {username ? username.charAt(0).toUpperCase() : "?"}
                    </AvatarFallback>
                  </Avatar>
                  
                  <button
                    onClick={() => picInputRef.current?.click()}
                    disabled={uploadingPic}
                    className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    {uploadingPic ? (
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    ) : (
                      <Camera className="h-6 w-6 text-white" />
                    )}
                  </button>
                </div>
                
                <div className="flex-1">
                  <div className="font-medium">{username}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    Click on the avatar to upload a new photo
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => picInputRef.current?.click()}
                    disabled={uploadingPic}
                  >
                    {uploadingPic ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4 mr-2" />
                        Change photo
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Username Section */}
          <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="p-5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
              <h2 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Username
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">Change your display name</p>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">New username</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    className="w-full rounded-xl border border-border bg-background pl-11 pr-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="Enter new username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                  />
                </div>
              </div>
              
              <Button
                onClick={handleChangeUsername}
                disabled={changingUsername || !newUsername.trim() || newUsername.trim() === username}
                className="bg-primary hover:bg-primary/90"
              >
                {changingUsername ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save username"
                )}
              </Button>
            </div>
          </div>

          {/* Password Section */}
          <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="p-5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
              <h2 className="font-semibold flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                Password
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">Update your password</p>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Current password</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    className="w-full rounded-xl border border-border bg-background pl-11 pr-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">New password</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    className="w-full rounded-xl border border-border bg-background pl-11 pr-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Confirm new password</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    className="w-full rounded-xl border border-border bg-background pl-11 pr-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="bg-primary hover:bg-primary/90"
              >
                {changingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </div>
          </div>

          {/* Logout Button */}
          <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  Sign out of your account
                </div>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                Sign out
              </Button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 overflow-hidden">
            <div className="p-5 border-b border-destructive/20">
              <h2 className="font-semibold text-destructive flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Danger Zone
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">Irreversible actions</p>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <div className="font-medium">Delete account</div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </div>
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">
                  Type <span className="font-mono text-destructive">{username}</span> to confirm
                </label>
                <input
                  className="w-full rounded-xl border border-destructive/30 bg-background px-4 py-3 text-sm outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/20 transition-all"
                  placeholder="Type your username to confirm"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                />
              </div>
              
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirm !== username}
              >
                {deletingAccount ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete my account
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          Q-Messaging • Built by Abdoulahi Diallo • Final Year Project 2025
        </div>
      </div>
    </main>
  );
}
