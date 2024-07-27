# npm / yarn

**1. Set Up the Project Structure**   

Create a New Directory for Your Project:
$ mkdir backend     
$ cd backend

**2. Initialize the Node.js Project:**   

$ yarn init -y

**3. Install Backend Dependencies**  

Install Express and Other Dependencies:
$ yarn add express body-parser cors mongoose dotenv nodemailer razorpay crypto jsonwebtoken bcryptjs

**4. Install Development Dependencies**   

If you need nodemon for development, install it as a development dependency:
$ yarn add --dev nodemon

**5. Add Scripts to package.json**   

Update your package.json to include the dev script using nodemon:

"scripts": {
  "start": "node src/index.js",     
  "dev": "nodemon src/index.js"
}

**6. Environment Variables**  

**#.env**   

PORT=5000   

JWT_SECRET=myverysecretkey123     

RAZORPAY_KEY_ID=    
RAZORPAY_KEY_SECRET=     

MONGO_URI=your_mongodb_connection_string --> MONGO_URI=mongodb://localhost:27017/FlightTrip   


MONGO_URI=your_mongodb_cloud_connection_string(https://www.mongodb.com/) -->     
MONGO_URI = mongodb+srv://username:password@cluster-address/database?retryWrites=true&w=majority   

EMAIL_USER=abcd123@gmail.com - admin emailId    
EMAIL_PASS=                  - admin emailPass    



**7. Test and Run Your Backend**     
Run the Development Server:   
$ yarn dev   


