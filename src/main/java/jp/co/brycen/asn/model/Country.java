package jp.co.brycen.asn.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import javax.persistence.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "countries")
public class Country {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;
    // JP, MM, KH, VN, KR, US

    @Column(nullable = false)
    private String name;
    // Japan, Myanmar, Cambodia...

    // ✅ DB မှာ flag_emoji column ရှိနေပြီ
    @Column(name = "flag_emoji")
    private String flagEmoji;
    // 🇯🇵, 🇲🇲, 🇰🇭 ...

    @Column(length = 10)
    private String currency;
    // JPY, MMK, USD, VND, KRW, USD
}