export default function DocsValidationRegistry() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">Validation Registry Contract</h1>
                <p className="text-lg text-gray-600">
                    Independent validation for high-value trades and operations.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Contract Code</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ValidationRegistry {
    enum ValidationResponse { Pending, Approved, Rejected, Disputed }
    
    struct ValidationRequest {
        address requester;
        uint256 agentId;
        string requestData;
        address validator;
        ValidationResponse response;
        string responseData;
        uint256 requestedAt;
        uint256 respondedAt;
    }
    
    mapping(bytes32 => ValidationRequest) public validations;
    mapping(address => bool) public authorizedValidators;
    
    event ValidationRequested(
        bytes32 indexed requestHash,
        address indexed requester,
        uint256 indexed agentId,
        address validator
    );
    
    event ValidationResponded(
        bytes32 indexed requestHash,
        ValidationResponse response
    );
    
    modifier onlyValidator() {
        require(authorizedValidators[msg.sender], "Not authorized validator");
        _;
    }
    
    function requestValidation(
        address validator,
        uint256 agentId,
        string memory requestData
    ) public returns (bytes32) {
        require(authorizedValidators[validator], "Validator not authorized");
        
        bytes32 requestHash = keccak256(
            abi.encodePacked(msg.sender, agentId, block.timestamp)
        );
        
        validations[requestHash] = ValidationRequest({
            requester: msg.sender,
            agentId: agentId,
            requestData: requestData,
            validator: validator,
            response: ValidationResponse.Pending,
            responseData: "",
            requestedAt: block.timestamp,
            respondedAt: 0
        });
        
        emit ValidationRequested(requestHash, msg.sender, agentId, validator);
        
        return requestHash;
    }
    
    function respondToValidation(
        bytes32 requestHash,
        ValidationResponse response,
        string memory responseData
    ) public onlyValidator {
        ValidationRequest storage request = validations[requestHash];
        require(request.validator == msg.sender, "Not assigned validator");
        require(request.response == ValidationResponse.Pending, "Already responded");
        
        request.response = response;
        request.responseData = responseData;
        request.respondedAt = block.timestamp;
        
        emit ValidationResponded(requestHash, response);
    }
    
    function getValidation(bytes32 requestHash) 
        public 
        view 
        returns (ValidationRequest memory) 
    {
        return validations[requestHash];
    }
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Request Validation</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`const validationRegistry = new ethers.Contract(
  VALIDATION_REGISTRY_ADDRESS,
  ValidationRegistryABI,
  signer
);

// Request validation for high-value trade
const requestData = JSON.stringify({
  tradeId: "trade_123",
  sizeUsd: 15000,
  venue: "Moonlander",
  executionPrice: 45234.50
});

const tx = await validationRegistry.requestValidation(
  VALIDATOR_ADDRESS,
  agentId,
  requestData
);

const receipt = await tx.wait();
const requestHash = receipt.logs[0].topics[1];

console.log('Validation requested:', requestHash);`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Check Validation Status</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`const validation = await validationRegistry.getValidation(requestHash);

console.log({
  requester: validation.requester,
  agentId: validation.agentId.toString(),
  validator: validation.validator,
  response: validation.response, // 0=Pending, 1=Approved, 2=Rejected, 3=Disputed
  requestedAt: new Date(validation.requestedAt * 1000),
  respondedAt: validation.respondedAt > 0 
    ? new Date(validation.respondedAt * 1000) 
    : null
});`}</code>
                </pre>
            </div>
        </div>
    );
}
