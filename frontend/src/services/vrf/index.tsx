import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Chip,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import CasinoIcon from '@mui/icons-material/Casino';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { registerServicePlugin } from '../../context/ServiceContext';
import { WorkstationProps } from '../../types';

// VRF Documentation Component
function VRFDocs() {
  return (
    <Box>
      <Card className="glass-card" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" mb={2}>
            VRF Service Documentation
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={3}>
            The Verifiable Random Function (VRF) Service provides cryptographically secure,
            verifiable random numbers for smart contracts. Perfect for gaming, NFT minting,
            lotteries, and any application requiring provably fair randomness.
          </Typography>

          <Typography variant="h6" mb={2}>
            How It Works
          </Typography>
          <Box component="ol" sx={{ pl: 2, color: 'text.secondary', mb: 3 }}>
            <li>Your smart contract requests a random number with a seed</li>
            <li>The VRF service generates a random number using TEE</li>
            <li>A cryptographic proof is generated alongside the random number</li>
            <li>The proof can be verified on-chain to ensure fairness</li>
          </Box>

          <Typography variant="h6" mb={2}>
            Quick Start
          </Typography>
          <Box className="code-block" sx={{ mb: 3 }}>
            <code>
              {`import { ServiceLayerClient } from '@service-layer/sdk';

const client = new ServiceLayerClient({
  endpoint: 'https://api.servicelayer.io',
  apiKey: 'your-api-key'
});

// Request a random number
const result = await client.vrf.requestRandom({
  seed: 'my-unique-seed-123',
  numWords: 1,
  callbackGasLimit: 100000
});

console.log('Request ID:', result.requestId);
console.log('Random Number:', result.randomWords[0]);
console.log('Proof:', result.proof);

// Verify the proof on-chain
const isValid = await client.vrf.verifyProof({
  requestId: result.requestId,
  proof: result.proof
});`}
            </code>
          </Box>

          <Typography variant="h6" mb={2}>
            Use Cases
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            {['Gaming', 'NFT Minting', 'Lotteries', 'Random Selection', 'Fair Distribution'].map((useCase) => (
              <Chip
                key={useCase}
                label={useCase}
                size="small"
                sx={{
                  backgroundColor: 'rgba(123, 97, 255, 0.2)',
                  color: '#7b61ff',
                }}
              />
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

// VRF Workstation Component
function VRFWorkstation({ wallet }: WorkstationProps) {
  const [seed, setSeed] = useState('');
  const [numWords, setNumWords] = useState('1');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    requestId: string;
    randomWords: string[];
    proof: string;
    timestamp: string;
  } | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const steps = ['Submit Request', 'Generate Random', 'Verify Proof'];

  const generateRandom = async () => {
    if (!seed) return;

    setLoading(true);
    setActiveStep(0);
    setResult(null);

    // Simulate the VRF process
    await new Promise((resolve) => setTimeout(resolve, 500));
    setActiveStep(1);

    await new Promise((resolve) => setTimeout(resolve, 800));
    setActiveStep(2);

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Generate mock random numbers
    const words = Array.from({ length: parseInt(numWords) || 1 }, () =>
      BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)).toString()
    );

    setResult({
      requestId: `vrf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      randomWords: words,
      proof: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      timestamp: new Date().toISOString(),
    });

    setActiveStep(3);
    setLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Box>
      {!wallet.connected && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Connect your wallet to request verifiable random numbers
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* Request Form */}
        <Card className="glass-card">
          <CardContent>
            <Typography variant="h6" mb={3}>
              Request Random Number
            </Typography>

            <TextField
              fullWidth
              label="Seed"
              placeholder="Enter a unique seed value"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              sx={{ mb: 2 }}
              helperText="A unique seed ensures different random outputs"
            />

            <TextField
              fullWidth
              label="Number of Random Words"
              type="number"
              value={numWords}
              onChange={(e) => setNumWords(e.target.value)}
              inputProps={{ min: 1, max: 10 }}
              sx={{ mb: 3 }}
              helperText="How many random numbers to generate (1-10)"
            />

            <Button
              variant="contained"
              fullWidth
              onClick={generateRandom}
              disabled={loading || !seed}
              startIcon={<CasinoIcon />}
              sx={{
                background: 'linear-gradient(90deg, #7b61ff, #5a45d6)',
                '&:hover': {
                  background: 'linear-gradient(90deg, #5a45d6, #4a35c6)',
                },
              }}
            >
              {loading ? 'Generating...' : 'Generate Random'}
            </Button>

            {loading && (
              <Box sx={{ mt: 3 }}>
                <Stepper activeStep={activeStep} alternativeLabel>
                  {steps.map((label) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
                <LinearProgress sx={{ mt: 2 }} />
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Result Display */}
        <Card className="glass-card">
          <CardContent>
            <Typography variant="h6" mb={3}>
              Result
            </Typography>

            {result ? (
              <Box>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    Request ID
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography
                      variant="body2"
                      fontFamily="monospace"
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {result.requestId}
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => copyToClipboard(result.requestId)}
                      sx={{ minWidth: 'auto' }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </Button>
                  </Box>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    Random Words
                  </Typography>
                  {result.randomWords.map((word, index) => (
                    <Box
                      key={index}
                      sx={{
                        p: 1.5,
                        mb: 1,
                        borderRadius: 1,
                        backgroundColor: 'rgba(123, 97, 255, 0.1)',
                        border: '1px solid rgba(123, 97, 255, 0.3)',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Word {index + 1}
                      </Typography>
                      <Typography variant="body1" fontFamily="monospace" fontWeight={600}>
                        {word}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    Cryptographic Proof
                  </Typography>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      wordBreak: 'break-all',
                    }}
                  >
                    <Typography variant="caption" fontFamily="monospace">
                      {result.proof}
                    </Typography>
                  </Box>
                </Box>

                <Chip
                  label="Verified"
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(0, 229, 153, 0.2)',
                    color: '#00e599',
                  }}
                />
              </Box>
            ) : (
              <Box
                sx={{
                  p: 4,
                  textAlign: 'center',
                  borderRadius: 2,
                  border: '1px dashed rgba(255, 255, 255, 0.2)',
                }}
              >
                <CasinoIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Submit a request to generate verifiable random numbers
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

// Register the VRF plugin
registerServicePlugin({
  serviceId: 'vrf',
  name: 'VRF Service',
  description: 'Verifiable random function for provably fair randomness',
  icon: CasinoIcon,
  DocsComponent: VRFDocs,
  WorkstationComponent: VRFWorkstation,
});

export { VRFDocs, VRFWorkstation };
