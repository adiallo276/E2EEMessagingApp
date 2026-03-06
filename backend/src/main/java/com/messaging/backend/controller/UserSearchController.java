package com.messaging.backend.controller;

import com.messaging.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/users")
public class UserSearchController {

    @Autowired
    private UserRepository users;

    @GetMapping("/search")
    public List<Map<String, Object>> searchUsers(
            @RequestParam String q,
            Principal principal
    ) {
        if (q == null || q.trim().isEmpty()) {
            return List.of();
        }

        String currentUsername = principal.getName();

        return users.findByUsernameContainingIgnoreCase(q.trim())
                .stream()
                .filter(u -> !u.getUsername().equals(currentUsername))
                .limit(10)
                .map(u -> Map.<String, Object>of(
                        "id", u.getId(),
                        "username", u.getUsername(),
                        "hasProfilePicture", u.getProfilePicture() != null
                ))
                .toList();
    }
}
