package com.messaging.backend.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String username;

    private String password;

    private String roles = "USER";

    @Lob
    @Column(name = "kyber_public_a")
    private String kyberPublicA;

    @Lob
    @Column(name = "kyber_public_t")
    private String kyberPublicT;

    @Lob
    @Column(name = "frodo_public_a")
    private String frodoPublicA;

    @Lob
    @Column(name = "frodo_public_b")
    private String frodoPublicB;

    public User() {}

    public User(String username, String password) {
        this.username = username;
        this.password = password;
    }

    public Long getId() { return id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getRoles() { return roles; }
    public void setRoles(String roles) { this.roles = roles; }

    public String getKyberPublicA() { return kyberPublicA; }
    public void setKyberPublicA(String kyberPublicA) { this.kyberPublicA = kyberPublicA; }

    public String getKyberPublicT() { return kyberPublicT; }
    public void setKyberPublicT(String kyberPublicT) { this.kyberPublicT = kyberPublicT; }

    public String getFrodoPublicA() { return frodoPublicA; }
    public void setFrodoPublicA(String frodoPublicA) { this.frodoPublicA = frodoPublicA; }

    public String getFrodoPublicB() { return frodoPublicB; }
    public void setFrodoPublicB(String frodoPublicB) { this.frodoPublicB = frodoPublicB; }
}