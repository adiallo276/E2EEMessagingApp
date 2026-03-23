package com.messaging.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
public class MeController {

    @GetMapping("/me")
    public String me(Principal principal) {
        return principal == null ? "NO_PRINCIPAL" : principal.getName();
    }
}