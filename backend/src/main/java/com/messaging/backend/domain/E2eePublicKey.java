package com.messaging.backend.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "e2ee_public_keys")
public class E2eePublicKey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String algorithm;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String aJson;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String tJson;

    public E2eePublicKey() {}

    public E2eePublicKey(String username, String algorithm, String aJson, String tJson) {
        this.username = username;
        this.algorithm = algorithm;
        this.aJson = aJson;
        this.tJson = tJson;
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getAlgorithm() { return algorithm; }
    public String getAJson() { return aJson; }
    public String getTJson() { return tJson; }

    public void setAlgorithm(String algorithm) { this.algorithm = algorithm; }
    public void setAJson(String aJson) { this.aJson = aJson; }
    public void setTJson(String tJson) { this.tJson = tJson; }
}