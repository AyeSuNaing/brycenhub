package jp.co.brycen.asn.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;

@Component
public class JwtUtil {

    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.expiration}")
    private long expiration;

    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes());
    }

    // Token generate လုပ်တယ်
    public String generateToken(String email, String role, Long userId) {
        return Jwts.builder()
                .setSubject(email)
                .claim("role", role)
                .claim("userId", userId)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    // Token ကနေ email ထုတ်တယ်
    public String getEmailFromToken(String token) {
        return getClaims(token).getSubject();
    }

    // Token ကနေ role ထုတ်တယ်
    public String getRoleFromToken(String token) {
        return (String) getClaims(token).get("role");
    }

    // Token ကနေ userId ထုတ်တယ်
    public Long getUserIdFromToken(String token) {
        return ((Number) getClaims(token).get("userId")).longValue();
    }

    // Token valid လားစစ်တယ်
    public boolean validateToken(String token) {
        try {
            getClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Claims getClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}