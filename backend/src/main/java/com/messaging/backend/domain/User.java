package com.messaging.backend.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String username;

    @JsonIgnore
    private String password;

    @JsonIgnore
    private String roles = "USER";

    @JsonIgnore
    @Lob
    @Column(name = "kyber_public_a")
    private String kyberPublicA;

    @JsonIgnore
    @Lob
    @Column(name = "kyber_public_t")
    private String kyberPublicT;

    @JsonIgnore
    @Lob
    @Column(name = "frodo_public_a")
    private String frodoPublicA;

    @JsonIgnore
    @Lob
    @Column(name = "frodo_public_b")
    private String frodoPublicB;

    @JsonIgnore
    @Lob
    @Column(name = "profile_picture")
    private String profilePicture;

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

    public String getProfilePicture() { return profilePicture; }
    public void setProfilePicture(String profilePicture) { this.profilePicture = profilePicture; }

    @JsonProperty("hasProfilePicture")
    public boolean getHasProfilePicture() { return profilePicture != null; }
}
