package com.messaging.backend.pqc;

import com.messaging.backend.domain.User;
import com.messaging.backend.pqc.dto.PqcKeyDtos.*;
import com.messaging.backend.repository.UserRepository;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/pqc")
public class PqcKeyController {

    private final UserRepository users;

    public PqcKeyController(UserRepository users) {
        this.users = users;
    }

    @PostMapping("/kyber/public-key")
    public void publishKyber(@RequestBody PublishKyberPublicKeyRequest req, Principal principal) {
        String me = principal.getName();
        User u = users.findByUsername(me).orElseThrow(() -> new RuntimeException("User not found"));

        u.setKyberPublicA(req.aJson);
        u.setKyberPublicT(req.tJson);

        users.save(u);
    }

    @GetMapping("/kyber/public-key/{username}")
    public KyberPublicKeyResponse getKyber(@PathVariable String username) {
        User u = users.findByUsername(username).orElseThrow(() -> new RuntimeException("User not found"));

        KyberPublicKeyResponse res = new KyberPublicKeyResponse();
        res.username = u.getUsername();
        res.aJson = u.getKyberPublicA();
        res.tJson = u.getKyberPublicT();
        return res;
    }

    @PostMapping("/frodo/public-key")
    public void publishFrodo(@RequestBody PublishFrodoPublicKeyRequest req, Principal principal) {
        String me = principal.getName();
        User u = users.findByUsername(me).orElseThrow(() -> new RuntimeException("User not found"));

        u.setFrodoPublicA(req.aJson);
        u.setFrodoPublicB(req.bJson);

        users.save(u);
    }

    @GetMapping("/frodo/public-key/{username}")
    public FrodoPublicKeyResponse getFrodo(@PathVariable String username) {
        User u = users.findByUsername(username).orElseThrow(() -> new RuntimeException("User not found"));

        FrodoPublicKeyResponse res = new FrodoPublicKeyResponse();
        res.username = u.getUsername();
        res.aJson = u.getFrodoPublicA();
        res.bJson = u.getFrodoPublicB();
        return res;
    }
}