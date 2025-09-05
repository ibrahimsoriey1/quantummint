import React from 'react';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const HelpCenter = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Help Center</Typography>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>How do I generate money?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography color="text.secondary">
            Navigate to the Generate page, fill in the required parameters, and submit your request.
            Ensure your KYC is verified and you have necessary permissions.
          </Typography>
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>How do I enable two-factor authentication?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography color="text.secondary">
            Go to the Security page and click Enable under Two-Factor Authentication. Then verify with your authenticator app.
          </Typography>
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Why was my transaction declined?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography color="text.secondary">
            Common reasons include insufficient balance, provider downtime, or KYC restrictions. Check the Transactions page for details.
          </Typography>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default HelpCenter;

