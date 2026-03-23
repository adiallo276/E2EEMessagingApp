package com.messaging.backend.controller;

import com.messaging.backend.domain.User;
import com.messaging.backend.repository.UserRepository;
import com.messaging.backend.security.jwt.JwtUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/users/me")
public class UserSettingsController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public UserSettingsController(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    /**
     * Change the current user's username
     */
    @PutMapping("/username")
    public ResponseEntity<?> changeUsername(@RequestBody Map<String, String> body, Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body("Not authenticated");
        }

        String newUsername = body.get("username");
        if (newUsername == null || newUsername.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Username is required");
        }

        newUsername = newUsername.trim();

        // Check if username is already taken
        Optional<User> existing = userRepository.findByUsername(newUsername);
        if (existing.isPresent() && !existing.get().getUsername().equals(principal.getName())) {
            return ResponseEntity.badRequest().body("Username is already taken");
        }

        // Find current user and update
        Optional<User> userOpt = userRepository.findByUsername(principal.getName());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body("User not found");
        }

        User user = userOpt.get();
        user.setUsername(newUsername);
        userRepository.save(user);

        // Generate a new JWT token with the new username
        String newToken = jwtUtil.generateToken(newUsername);

        return ResponseEntity.ok(Map.of(
            "message", "Username updated successfully",
            "token", newToken,
            "username", newUsername
        ));
    }

    /**
     * Change the current user's password
     */
    @PutMapping("/password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String, String> body, Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body("Not authenticated");
        }

        String currentPassword = body.get("currentPassword");
        String newPassword = body.get("newPassword");

        if (currentPassword == null || currentPassword.isEmpty()) {
            return ResponseEntity.badRequest().body("Current password is required");
        }

        if (newPassword == null || newPassword.isEmpty()) {
            return ResponseEntity.badRequest().body("New password is required");
        }

        if (newPassword.length() < 4) {
            return ResponseEntity.badRequest().body("Password must be at least 4 characters");
        }

        // Find current user
        Optional<User> userOpt = userRepository.findByUsername(principal.getName());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body("User not found");
        }

        User user = userOpt.get();

        // Verify current password
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            return ResponseEntity.badRequest().body("Current password is incorrect");
        }

        // Update password
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        return ResponseEntity.ok().body("Password updated successfully");
    }

    /**
     * Delete the current user's account
     */
    @DeleteMapping
    public ResponseEntity<?> deleteAccount(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body("Not authenticated");
        }

        Optional<User> userOpt = userRepository.findByUsername(principal.getName());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body("User not found");
        }

        userRepository.delete(userOpt.get());

        return ResponseEntity.ok().body("Account deleted successfully");
    }

    /**
     * Get current user's profile info
     */
    @GetMapping
    public ResponseEntity<?> getProfile(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body("Not authenticated");
        }

        Optional<User> userOpt = userRepository.findByUsername(principal.getName());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body("User not found");
        }

        User user = userOpt.get();
        
        return ResponseEntity.ok(Map.of(
            "id", user.getId(),
            "username", user.getUsername(),
            "hasProfilePicture", user.getHasProfilePicture()
        ));
    }
}
