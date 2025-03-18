import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Box, Container, Grid, Typography, Paper, Button, 
  Card, CardContent, CardMedia, CardActions, Divider,
  List, ListItem, ListItemIcon, ListItemText
} from '@mui/material';
import { 
  Description, InsertDriveFile, AutoAwesome, 
  AssessmentOutlined, PsychologyAlt, Security,
  DataObject, Analytics, Compare, AutoGraph,
  CloudUpload, SmartToy, Gavel, QueryStats
} from '@mui/icons-material';

const FeatureCard = ({ title, description, icon, buttonText = "Learn More" }) => (
  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 3 }}>
    <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
      {icon}
    </Box>
    <CardContent sx={{ flexGrow: 1 }}>
      <Typography gutterBottom variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        {description}
      </Typography>
    </CardContent>
    <CardActions>
      <Button size="small" color="primary">
        {buttonText}
      </Button>
    </CardActions>
  </Card>
);

export default function Products() {
  return (
    <Box sx={{ py: 8 }}>
      <Container maxWidth="lg">
        {/* Hero Section */}
        <Box sx={{ mb: 8, textAlign: 'center' }}>
          <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Our Document Intelligence Platform
          </Typography>
          <Typography variant="h5" color="text.secondary" paragraph>
            Powerful document automation and analysis tools for legal professionals and knowledge workers
          </Typography>
          <Button 
            variant="contained" 
            size="large" 
            component={Link} 
            to="/register"
            sx={{ mt: 4 }}
          >
            Start Free Trial
          </Button>
        </Box>

        {/* Document Processing Section */}
        <Box sx={{ mb: 8 }}>
          <Typography variant="h4" component="h2" gutterBottom sx={{ mb: 4, fontWeight: 'bold' }}>
            Document Processing
          </Typography>
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <FeatureCard
                title="Smart Document Upload"
                description="Upload and process documents in multiple formats including PDF, Word, and plain text. Our system automatically extracts and analyzes content while preserving document structure."
                icon={<CloudUpload sx={{ fontSize: 60, color: 'primary.main' }} />}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FeatureCard
                title="PDF Intelligence"
                description="Advanced PDF parsing capabilities that can handle complex documents, extracting text, tables, and metadata with high accuracy, even from scanned documents."
                icon={<Description sx={{ fontSize: 60, color: 'primary.main' }} />}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FeatureCard
                title="Document Conversion"
                description="Seamlessly convert between document formats while maintaining content integrity. Extract text from various file types for further processing."
                icon={<InsertDriveFile sx={{ fontSize: 60, color: 'primary.main' }} />}
              />
            </Grid>
          </Grid>
        </Box>

        {/* Workflow Automation Section */}
        <Box sx={{ mb: 8 }}>
          <Typography variant="h4" component="h2" gutterBottom sx={{ mb: 4, fontWeight: 'bold' }}>
            Workflow Automation
          </Typography>
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <FeatureCard
                title="Contract Automation"
                description="Streamline contract creation and review processes. Automatically extract key provisions, dates, and obligations from agreements to reduce manual review time."
                icon={<AutoAwesome sx={{ fontSize: 60, color: 'primary.main' }} />}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FeatureCard
                title="Document Analysis"
                description="AI-powered document analysis identifies key information, risk factors, and actionable insights within your documents, helping you make informed decisions faster."
                icon={<AssessmentOutlined sx={{ fontSize: 60, color: 'primary.main' }} />}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FeatureCard
                title="Redlining & Comparison"
                description="Easily compare document versions and track changes with our intelligent redlining tools. Identify modifications, additions, and deletions in seconds."
                icon={<Compare sx={{ fontSize: 60, color: 'primary.main' }} />}
              />
            </Grid>
          </Grid>
        </Box>

        {/* AI & Analytics Section */}
        <Box sx={{ mb: 8 }}>
          <Typography variant="h4" component="h2" gutterBottom sx={{ mb: 4, fontWeight: 'bold' }}>
            AI & Analytics
          </Typography>
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <FeatureCard
                title="Legal AI Assistant"
                description="Specialized AI tools for legal research and document analysis. Automatically identify legal concepts, precedents, and potential issues in contracts and legal documents."
                icon={<Gavel sx={{ fontSize: 60, color: 'primary.main' }} />}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FeatureCard
                title="Document Analytics"
                description="Gain insights into your document repository with comprehensive analytics. Track document types, processing times, and key metrics to optimize your workflows."
                icon={<QueryStats sx={{ fontSize: 60, color: 'primary.main' }} />}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FeatureCard
                title="Continuous Learning"
                description="Our AI system continuously improves based on your document data, providing increasingly accurate and relevant analysis over time while maintaining data privacy."
                icon={<PsychologyAlt sx={{ fontSize: 60, color: 'primary.main' }} />}
              />
            </Grid>
          </Grid>
        </Box>

        {/* Call to Action */}
        <Paper elevation={3} sx={{ p: 6, textAlign: 'center', borderRadius: 3, mt: 8 }}>
          <Typography variant="h4" component="h2" gutterBottom>
            Ready to transform your document workflows?
          </Typography>
          <Typography variant="body1" paragraph sx={{ mb: 4 }}>
            Join thousands of professionals who are saving time and gaining insights with our document intelligence platform.
          </Typography>
          <Button 
            variant="contained" 
            size="large" 
            component={Link} 
            to="/register"
            sx={{ mr: 2 }}
          >
            Start Free Trial
          </Button>
          <Button 
            variant="outlined" 
            size="large" 
            component={Link} 
            to="/contact"
          >
            Contact Sales
          </Button>
        </Paper>
      </Container>
    </Box>
  );
} 