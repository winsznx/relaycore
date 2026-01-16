// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 + EscrowSession
// Flattened for Cronoscan verification

pragma solidity ^0.8.20;

// === IERC20 ===
interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

// === IERC20Permit ===
interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

// === Address ===
library Address {
    function isContract(address account) internal view returns (bool) {
        return account.code.length > 0;
    }

    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Address: unable to send value, recipient may have reverted");
    }

    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, "Address: low-level call failed");
    }

    function functionCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, errorMessage);
    }

    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        return functionCallWithValue(target, data, value, "Address: low-level call with value failed");
    }

    function functionCallWithValue(
        address target,
        bytes memory data,
        uint256 value,
        string memory errorMessage
    ) internal returns (bytes memory) {
        require(address(this).balance >= value, "Address: insufficient balance for call");
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        return functionStaticCall(target, data, "Address: low-level static call failed");
    }

    function functionStaticCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionDelegateCall(target, data, "Address: low-level delegate call failed");
    }

    function functionDelegateCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    function verifyCallResultFromTarget(
        address target,
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        if (success) {
            if (returndata.length == 0) {
                require(isContract(target), "Address: call to non-contract");
            }
            return returndata;
        } else {
            _revert(returndata, errorMessage);
        }
    }

    function verifyCallResult(
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal pure returns (bytes memory) {
        if (success) {
            return returndata;
        } else {
            _revert(returndata, errorMessage);
        }
    }

    function _revert(bytes memory returndata, string memory errorMessage) private pure {
        if (returndata.length > 0) {
            assembly {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert(errorMessage);
        }
    }
}

// === SafeERC20 ===
library SafeERC20 {
    using Address for address;

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transfer.selector, to, value));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, value));
    }

    function safeApprove(IERC20 token, address spender, uint256 value) internal {
        require(
            (value == 0) || (token.allowance(address(this), spender) == 0),
            "SafeERC20: approve from non-zero to non-zero allowance"
        );
        _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, value));
    }

    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, oldAllowance + value));
    }

    function safeDecreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        unchecked {
            uint256 oldAllowance = token.allowance(address(this), spender);
            require(oldAllowance >= value, "SafeERC20: decreased allowance below zero");
            _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, oldAllowance - value));
        }
    }

    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        bytes memory approvalCall = abi.encodeWithSelector(token.approve.selector, spender, value);
        if (!_callOptionalReturnBool(token, approvalCall)) {
            _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, 0));
            _callOptionalReturn(token, approvalCall);
        }
    }

    function safePermit(
        IERC20Permit token,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        uint256 nonceBefore = token.nonces(owner);
        token.permit(owner, spender, value, deadline, v, r, s);
        uint256 nonceAfter = token.nonces(owner);
        require(nonceAfter == nonceBefore + 1, "SafeERC20: permit did not succeed");
    }

    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        bytes memory returndata = address(token).functionCall(data, "SafeERC20: low-level call failed");
        require(returndata.length == 0 || abi.decode(returndata, (bool)), "SafeERC20: ERC20 operation did not succeed");
    }

    function _callOptionalReturnBool(IERC20 token, bytes memory data) private returns (bool) {
        (bool success, bytes memory returndata) = address(token).call(data);
        return
            success && (returndata.length == 0 || abi.decode(returndata, (bool))) && Address.isContract(address(token));
    }
}

// === ReentrancyGuard ===
abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
    }

    function _nonReentrantAfter() private {
        _status = _NOT_ENTERED;
    }

    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == _ENTERED;
    }
}

// === EscrowSession ===
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

    function deposit(uint256 sessionId, uint256 amount) external nonReentrant {
        Session storage session = sessions[sessionId];
        require(session.active, "Session not active");
        require(block.timestamp < session.expiry, "Session expired");
        require(session.deposited + amount <= session.maxSpend, "Exceeds max spend");

        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        session.deposited += amount;

        emit FundsDeposited(sessionId, msg.sender, amount);
    }

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

    function authorizeAgent(uint256 sessionId, address agent) external {
        Session storage session = sessions[sessionId];
        require(msg.sender == session.owner || msg.sender == session.escrowAgent, "Not authorized");
        authorizedAgents[sessionId][agent] = true;
        emit AgentAuthorized(sessionId, agent);
    }

    function revokeAgent(uint256 sessionId, address agent) external {
        Session storage session = sessions[sessionId];
        require(msg.sender == session.owner || msg.sender == session.escrowAgent, "Not authorized");
        authorizedAgents[sessionId][agent] = false;
        emit AgentRevoked(sessionId, agent);
    }

    function remainingBalance(uint256 sessionId) public view returns (uint256) {
        Session storage session = sessions[sessionId];
        return session.deposited - session.released;
    }

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

    function isAgentAuthorized(uint256 sessionId, address agent) external view returns (bool) {
        return authorizedAgents[sessionId][agent];
    }

    function getAgentSpend(uint256 sessionId, address agent) external view returns (uint256) {
        return agentSpend[sessionId][agent];
    }
}
