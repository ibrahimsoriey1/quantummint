# QuantumMint Frontend

This is the frontend application for QuantumMint, a digital money generator platform. The frontend is built using React and provides a user interface for interacting with the QuantumMint services.

## Features

- **User Authentication**: Registration, login, password reset, and two-factor authentication
- **Dashboard**: Overview of wallet balance, generation statistics, and recent transactions
- **Money Generation**: Generate digital money with different methods and options
- **Wallet Management**: View balance, transfer money, deposit, and withdraw
- **Transaction History**: View and filter transaction history
- **Payment Methods**: Manage payment methods for deposits and withdrawals
- **KYC Verification**: Complete the Know Your Customer verification process
- **User Profile**: Update personal information, change password, and manage security settings

## Technology Stack

- **React**: JavaScript library for building user interfaces
- **React Router**: For navigation and routing
- **Material UI**: Component library for consistent design
- **Formik & Yup**: Form handling and validation
- **Axios**: HTTP client for API requests
- **Chart.js**: For data visualization
- **JWT**: For authentication token management

## Project Structure

```
frontend/
├── public/                 # Public assets
├── src/                    # Source code
│   ├── assets/             # Static assets
│   │   ├── images/         # Image files
│   │   └── styles/         # CSS and style files
│   ├── components/         # Reusable components
│   │   ├── common/         # Common UI components
│   │   └── layouts/        # Layout components
│   ├── context/            # React context providers
│   ├── hooks/              # Custom React hooks
│   ├── pages/              # Page components
│   │   ├── auth/           # Authentication pages
│   │   └── errors/         # Error pages
│   ├── services/           # API service functions
│   └── utils/              # Utility functions
├── App.js                  # Main application component
└── index.js                # Entry point
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the frontend directory:
   ```
   cd quantummint/frontend
   ```
3. Install dependencies:
   ```
   npm install
   ```
   or
   ```
   yarn install
   ```

### Running the Development Server

```
npm start
```
or
```
yarn start
```

The application will be available at http://localhost:3000.

### Building for Production

```
npm run build
```
or
```
yarn build
```

This will create an optimized production build in the `build` directory.

## API Integration

The frontend communicates with the backend services through the API Gateway. The API endpoints are defined in the service files in the `src/services` directory.

## Authentication

Authentication is handled using JWT (JSON Web Tokens). The authentication flow includes:

1. User registration
2. Email verification
3. Login with username/password
4. Optional two-factor authentication
5. Token-based session management
6. Password reset functionality

## Responsive Design

The application is designed to be responsive and work well on various screen sizes, from mobile devices to desktop computers.

## Security Features

- JWT-based authentication
- Two-factor authentication
- Secure password handling
- Input validation
- Protected routes
- Session management

## Future Enhancements

- Dark mode support
- Additional language support
- Push notifications
- Enhanced analytics dashboard
- Mobile app integration