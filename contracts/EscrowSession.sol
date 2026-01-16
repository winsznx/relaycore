// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * Agent-Controlled Payment Session (ACPS) Escrow Contract
 * 
 * Minimal escrow for session-based agent payments.
 * Logic orchestration handled by Escrow Agent, not Solidity.
 */
contract EscrowSession is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Session {
        address owner;
        address escrowAgent;
        uint256 deposited;
        uint256 released;
        uint256 maxSpend;
        uint256 expiry;
        bool active;
    }

    IERC20 public immutable paymentToken;
    uint256 public sessionCounter;
    
    mapping(uint256 => Session) public sessions;
    mapping(uint256 => mapping(address => bool)) public authorizedAgents;
    mapping(uint256 => mapping(address => uint256)) public agentSpend;

    event SessionCreated(
        uint256 indexed sessionId,
        address indexed owner,
        address escrowAgent,
        uint256 maxSpend,
        uint256 expiry
    );
    
    event FundsDeposited(
        uint256 indexed sessionId,
        address indexed depositor,
        uint256 amount
    );
    
    event PaymentReleased(
        uint256 indexed sessionId,
        address indexed agent,
        uint256 amount,
        bytes32 executionId
    );
    
    event SessionRefunded(
        uint256 indexed sessionId,
        address indexed owner,
        uint256 amount
    );
    
    event SessionClosed(uint256 indexed sessionId);
    
    event AgentAuthorized(uint256 indexed sessionId, address indexed agent);
    event AgentRevoked(uint256 indexed sessionId, address indexed agent);

    constructor(address _paymentToken) {
        paymentToken = IERC20(_paymentToken);
    }

    /**
     * Create a new payment session
     */
    function createSession(
        address escrowAgent,
        uint256 maxSpend,
        uint256 duration,
        address[] calldata agents
    ) external returns (uint256 sessionId) {
        sessionId = ++sessionCounter;
        
        sessions[sessionId] = Session({
            owner: msg.sender,
            escrowAgent: escrowAgent,
            deposited: 0,
            released: 0,
            maxSpend: maxSpend,
            expiry: block.timestamp + duration,
            active: true
        });

        for (uint256 i = 0; i < agents.length; i++) {
            authorizedAgents[sessionId][agents[i]] = true;
            emit AgentAuthorized(sessionId, agents[i]);
        }

        emit SessionCreated(sessionId, msg.sender, escrowAgent, maxSpend, duration);
    }

    /**
     * Deposit funds into session
     */
    function deposit(uint256 sessionId, uint256 amount) external nonReentrant {
        Session storage session = sessions[sessionId];
        require(session.active, "Session not active");
        require(block.timestamp < session.expiry, "Session expired");
        require(session.deposited + amount <= session.maxSpend, "Exceeds max spend");

        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        session.deposited += amount;

        emit FundsDeposited(sessionId, msg.sender, amount);
    }

    /**
     * Release payment to an agent (called by escrow agent only)
     */
    function release(
        uint256 sessionId,
        address agent,
        uint256 amount,
        bytes32 executionId
    ) external nonReentrant {
        Session storage session = sessions[sessionId];
        require(session.active, "Session not active");
        require(msg.sender == session.escrowAgent, "Only escrow agent");
        require(block.timestamp < session.expiry, "Session expired");
        require(authorizedAgents[sessionId][agent], "Agent not authorized");
        require(remainingBalance(sessionId) >= amount, "Insufficient balance");

        session.released += amount;
        agentSpend[sessionId][agent] += amount;
        
        paymentToken.safeTransfer(agent, amount);

        emit PaymentReleased(sessionId, agent, amount, executionId);
    }

    /**
     * Refund remaining balance to owner
     */
    function refund(uint256 sessionId) external nonReentrant {
        Session storage session = sessions[sessionId];
        require(
            msg.sender == session.owner || 
            msg.sender == session.escrowAgent ||
            block.timestamp >= session.expiry,
            "Not authorized"
        );

        uint256 remaining = remainingBalance(sessionId);
        require(remaining > 0, "No balance to refund");

        session.deposited = session.released;
        paymentToken.safeTransfer(session.owner, remaining);

        emit SessionRefunded(sessionId, session.owner, remaining);
    }

    /**
     * Close session (refunds remaining automatically)
     */
    function closeSession(uint256 sessionId) external {
        Session storage session = sessions[sessionId];
        require(
            msg.sender == session.owner || msg.sender == session.escrowAgent,
            "Not authorized"
        );
        require(session.active, "Already closed");

        session.active = false;

        uint256 remaining = remainingBalance(sessionId);
        if (remaining > 0) {
            session.deposited = session.released;
            paymentToken.safeTransfer(session.owner, remaining);
            emit SessionRefunded(sessionId, session.owner, remaining);
        }

        emit SessionClosed(sessionId);
    }

    /**
     * Authorize additional agent
     */
    function authorizeAgent(uint256 sessionId, address agent) external {
        Session storage session = sessions[sessionId];
        require(msg.sender == session.owner || msg.sender == session.escrowAgent, "Not authorized");
        authorizedAgents[sessionId][agent] = true;
        emit AgentAuthorized(sessionId, agent);
    }

    /**
     * Revoke agent authorization
     */
    function revokeAgent(uint256 sessionId, address agent) external {
        Session storage session = sessions[sessionId];
        require(msg.sender == session.owner || msg.sender == session.escrowAgent, "Not authorized");
        authorizedAgents[sessionId][agent] = false;
        emit AgentRevoked(sessionId, agent);
    }

    /**
     * Get remaining balance in session
     */
    function remainingBalance(uint256 sessionId) public view returns (uint256) {
        Session storage session = sessions[sessionId];
        return session.deposited - session.released;
    }

    /**
     * Get session details
     */
    function getSession(uint256 sessionId) external view returns (
        address owner,
        address escrowAgent,
        uint256 deposited,
        uint256 released,
        uint256 remaining,
        uint256 maxSpend,
        uint256 expiry,
        bool active
    ) {
        Session storage session = sessions[sessionId];
        return (
            session.owner,
            session.escrowAgent,
            session.deposited,
            session.released,
            remainingBalance(sessionId),
            session.maxSpend,
            session.expiry,
            session.active
        );
    }

    /**
     * Check if agent is authorized for session
     */
    function isAgentAuthorized(uint256 sessionId, address agent) external view returns (bool) {
        return authorizedAgents[sessionId][agent];
    }

    /**
     * Get agent spend for session
     */
    function getAgentSpend(uint256 sessionId, address agent) external view returns (uint256) {
        return agentSpend[sessionId][agent];
    }
}
