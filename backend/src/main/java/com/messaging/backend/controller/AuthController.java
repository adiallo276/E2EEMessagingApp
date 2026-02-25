package com.messaging.backend.controller;

import com.messaging.backend.domain.User;
import com.messaging.backend.repository.UserRepository;
import com.messaging.backend.security.jwt.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class AuthController {

    @Autowired private UserRepository users;
    @Autowired private PasswordEncoder encoder;
    @Autowired private JwtUtil jwt;

    @PostMapping("/register")
    public String register(@RequestBody AuthRequest req) {
        User user = new User(req.username, encoder.encode(req.password));
        users.save(user);
        return "Registered successfully";
    }

    @PostMapping("/login")
    public String login(@RequestBody AuthRequest req) {
        User user = users.findByUsername(req.username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!encoder.matches(req.password, user.getPassword())) {
            throw new RuntimeException("Wrong password");
        }

        return jwt.generateToken(req.username);
    }

    static class AuthRequest {
        public String username;
        public String password;
    }
}