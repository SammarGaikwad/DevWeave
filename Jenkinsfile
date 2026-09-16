pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
               echo 'Checking out DevWeave source code for CI...'
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing project dependencies...'
                sh 'npm ci'
            }
        }

        stage('Build Frontend') {
            steps {
                echo 'Building DevWeave frontend...'
                dir('devweave-app') {
                    sh 'npm ci'
                    sh 'npm run build'
                }
            }
        }

        stage('Build Backend') {
            steps {
                echo 'Building DevWeave backend...'
                dir('devweave-backend') {
                    sh 'npm ci'
                    sh 'npm run build'
                }
            }
        }
    }

    post {
        success {
            echo 'DevWeave CI pipeline completed successfully! 🚀'
        }

        failure {
            echo 'DevWeave CI pipeline failed. Check the console output.'
        }
    }
}
