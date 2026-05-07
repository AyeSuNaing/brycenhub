package jp.co.brycen.asn.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "call_invites")
public class CallInvite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "caller_id", nullable = false)
    private Long callerId;

    @Column(name = "callee_id", nullable = false)
    private Long calleeId;

    @Column(name = "room_id", nullable = false)
    private String roomId;

    @Column(name = "mode", nullable = false)
    private String mode; // voice | video

    @Column(name = "caller_name")
    private String callerName;

    @Column(name = "caller_user_id")
    private String callerUserId;

    @Column(name = "is_group")
    private boolean isGroup = false;

    @Column(name = "status")
    private String status = "PENDING"; // PENDING | ACCEPTED | REJECTED | EXPIRED

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}
