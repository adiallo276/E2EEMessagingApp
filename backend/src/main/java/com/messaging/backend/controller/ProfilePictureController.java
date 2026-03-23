package com.messaging.backend.controller;

import com.messaging.backend.domain.User;
import com.messaging.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.Base64;

@RestController
@RequestMapping("/users")
public class ProfilePictureController {

    @Autowired
    private UserRepository users;

    /**
     * Upload or update the authenticated user's profile picture.
     * Accepts a multipart file upload (image/png, image/jpeg, image/gif, image/webp).
     * Stores as a base64 data URL in the database.
     */
    @PostMapping("/me/profile-picture")
    public ResponseEntity<String> uploadProfilePicture(
            @RequestParam("file") MultipartFile file,
            Principal principal
    ) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("No file provided");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body("File must be an image");
        }

        if (file.getSize() > 2 * 1024 * 1024) {
            return ResponseEntity.badRequest().body("File must be smaller than 2MB");
        }

        try {
            User user = users.findByUsername(principal.getName())
                    .orElseThrow(() -> new RuntimeException("User not found"));

            byte[] bytes = file.getBytes();
            String base64 = Base64.getEncoder().encodeToString(bytes);
            String dataUrl = "data:" + contentType + ";base64," + base64;

            user.setProfilePicture(dataUrl);
            users.save(user);

            return ResponseEntity.ok("Profile picture updated");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to upload: " + e.getMessage());
        }
    }

    /**
     * Delete the authenticated user's profile picture.
     */
    @DeleteMapping("/me/profile-picture")
    public ResponseEntity<String> deleteProfilePicture(Principal principal) {
        User user = users.findByUsername(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setProfilePicture(null);
        users.save(user);

        return ResponseEntity.ok("Profile picture removed");
    }

    /**
     * Serve a user's profile picture as raw image bytes.
     * This endpoint is PUBLIC (no auth required) so <img src="..."> tags work.
     */
    @GetMapping("/{username}/profile-picture")
    public ResponseEntity<byte[]> getProfilePicture(@PathVariable String username) {
        User user = users.findByUsername(username).orElse(null);

        if (user == null || user.getProfilePicture() == null) {
            return ResponseEntity.notFound().build();
        }

        String dataUrl = user.getProfilePicture();

        try {
            // Parse data URL: "data:image/jpeg;base64,/9j/4AAQ..."
            String[] parts = dataUrl.split(",", 2);
            String meta = parts[0]; // "data:image/jpeg;base64"
            String base64Data = parts[1];

            String mimeType = meta.substring(meta.indexOf(":") + 1, meta.indexOf(";"));

            byte[] imageBytes = Base64.getDecoder().decode(base64Data);

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(mimeType))
                    .body(imageBytes);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
