import { Customer } from "./schemas.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import { Service } from "./schemas.js";
import dotenv from "dotenv";
import { Request } from "./schemas.js";
import { request } from "express";
import { SavedService, ServiceProvider } from "./schemas.js";

dotenv.config();
export const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});




/**
 * @swagger
 * /customer/signup:
 *   post:
 *     summary: Register a new customer
 *     description: Create a new customer account
 *     tags: [Customer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Customer created successfully
 *       400:
 *         description: Email already registered
 */
export async function handleSignup(req, res) {
    try {
        const { name, email, password, phone } = req.body;
        const found = await Customer.findOne({ email: email, isVerified: true });
        if (found) {
            return res.status(400).json({
                success: false,
                message: "This email is already registered",
                data: null
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 60 * 1000); // 1 minute expiry
        const customer = new Customer({ name, email, password: hashedPassword, phone, otp, otpExpiry });
        await customer.save();
        console.log("DEV MODE - Generated OTP:", otp);
        res.status(201).json({ message: "Customer created successfully", customerId: customer._id });
        await sendOTP(customer.otp, customer.email); // Call the sendOTP function
    } catch (error) {
        console.error("Error creating customer:", error);
        res.status(500).json({ message: "Error creating customer" });
    }
}


/**
 * @swagger
 * /customer/signin:
 *   post:
 *     summary: Customer Sign In
 *     description: Authenticate a customer
 *     tags: [Customer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid email or password
 */
export async function handleSigniIn(req, res) {
    const { email, password } = req.body;
    const customer = await Customer.findOne({ email: email, isVerified: true });
    if (!customer) {
        return res.status(400).json({ message: "Invalid email" });
    }
    const isPasswordValid = await bcrypt.compare(password, customer.password);
    if (!isPasswordValid) {
        return res.status(400).json({ message: "Invalid password" });
    }
    res.status(200).json({ message: "Customer signed in successfully", data: customer });
}


function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000);
}

export async function sendOTP(otp, email) {
    try {
        const mailOptions = {
            from: `"Khadamaty" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Your OTP from Khadamaty",
            html: `
            <div style="font-family: sans-serif; background-color: #f7f8fc; padding: 40px; text-align: center;">
                <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 24px; box-shadow: 0 20px 60px rgba(15, 27, 64, 0.08);">
                    <h1 style="color: #2a4dd0; margin-bottom: 24px; font-family: sans-serif;">Khadamaty</h1>
                    <p style="color: #4b5563; font-size: 16px; margin-bottom: 32px; line-height: 1.5;">
                        Use the following One-Time Password (OTP) to complete your verification.<br>
                        This code will expire in 1 minute.
                    </p>
                    <div style="background-color: #eef2ff; padding: 20px; border-radius: 12px; display: inline-block; margin-bottom: 32px;">
                        <span style="font-size: 32px; font-weight: bold; color: #2a4dd0; letter-spacing: 4px;">${otp}</span>
                    </div>
                    <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                        If you didn't request this code, please ignore this email.
                    </p>
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e4e8f3;">
                        <p style="color: #9ca3af; font-size: 12px;">&copy; ${new Date().getFullYear()} Khadamaty. All rights reserved.</p>
                    </div>
                </div>
            </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent:", info.messageId);

        return true;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
}


/**
 * @swagger
 * /customer/verify-otp:
 *   post:
 *     summary: Verify OTP
 *     tags: [Customer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - otp
 *             properties:
 *               id:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification successful
 *       400:
 *         description: Invalid OTP
 */
export async function verifyOtp(req, res) {
    try {
        const { id, otp } = req.body;
        const customer = await Customer.findOne({ _id: id, otp: otp, otpExpiry: { $gt: Date.now() } });
        if (!customer) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }
        customer.isVerified = true;
        customer.otp = null;
        customer.otpExpiry = null;
        await customer.save();
        res.status(200).json({
            message: "Customer verified successfully",
            customer: customer,
            customerId: customer._id
        });
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ message: "Error verifying OTP" });
    }
}


/**
 * @swagger
 * /customer/services:
 *   get:
 *     summary: Get available services
 *     tags: [Customer]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: List of services
 */
export async function getServices(req, res) {
    try {
        const { category, priceRange } = req.query;
        const filter = category && category !== "all" ? { category } : {};
        const services = await Service.find(filter);
        res.status(200).json({ message: "Services fetched successfully", services: services });
    } catch (error) {
        console.error("Error fetching services:", error);
        res.status(500).json({ message: "Error fetching services" });
    }
}


/**
 * @swagger
 * /customer/book:
 *   post:
 *     summary: Book a service
 *     tags: [Customer]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Customer ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serviceId
 *               - datetime
 *             properties:
 *               serviceId:
 *                 type: string
 *               datetime:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Booking successful
 */
export async function requestService(req, res) {
    try {
        const customerId = req.query.id;
        if (!customerId) {
            return res.status(400).json({ message: "Customer ID is required" });
        }
        const { serviceId, datetime, notes } = req.body;
        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ message: "Service not found" });
        }
        await service.count++;
        await service.save();
        const newRequest = new Request({ serviceId, datetime, notes, customerId })
        await newRequest.save();
        res.status(201).json({
            success: true,
            message: "Booking successful",
            data: newRequest,
        });
    }
    catch (error) {
        console.error("Error fetching services:", error);
        res.status(500).json({ message: "Error fetching services: check console" });
    }
}

/**
 * @swagger
 * /customer/active-requests:
 *   get:
 *     summary: Get active requests
 *     tags: [Customer]
 *     parameters:
 *       - in: query
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of active requests
 */
export async function getActiveRequests(req, res) {
    try {
        const { customerId } = req.query;
        if (!customerId) {
            return res.status(400).json({ message: "Customer ID is required" });
        }
        const requestssss = await Request.find({ customerId: customerId });
        const requests = await Request.find({ customerId: customerId, status: { $in: ["pending", "active"] } });
        if (!requests || requests.length === 0) {
            return res.status(404).json({ message: "No active requests found!!" });
        }
        res.status(200).json({ message: "Requests fetched successfully", requests: requests });
    } catch (error) {
        console.error("Error fetching requests:", error);
        res.status(500).json({ message: "Error fetching requests" });
    }
}

/**
 * @swagger
 * /customer/past-requests:
 *   get:
 *     summary: Get past requests
 *     tags: [Customer]
 *     parameters:
 *       - in: query
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of past requests
 */
export async function getPastRequests(req, res) {
    try {
        const { customerId } = req.query;
        if (!customerId) {
            return res.status(400).json({ message: "Customer ID is required" });
        }
        const requests = await Request.find({ customerId: customerId, status: { $in: ["completed", "cancelled"] } });
        if (!requests || requests.length === 0) {
            return res.status(404).json({ message: "No past requests found" });
        }
        res.status(200).json({ message: "Requests fetched successfully", requests: requests });
    } catch (error) {
        console.error("Error fetching requests:", error);
        res.status(500).json({ message: "Error fetching requests" });
    }
}



/**
 * @swagger
 * /customer/save-service:
 *   post:
 *     summary: Save a service for later
 *     tags: [Customer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - serviceId
 *             properties:
 *               customerId:
 *                 type: string
 *               serviceId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Service saved successfully
 */
export async function saveService(req, res) {
    try {
        const { customerId, serviceId } = req.body;
        const savedService = new SavedService({ customerId, serviceId });
        await savedService.save();
        res.status(201).json({ message: "Service saved successfully" });
    } catch (error) {
        console.error("Error saving service:", error);
        res.status(500).json({ message: "Error saving service" });
    }
}


/**
 * @swagger
 * /customer/saved-services:
 *   get:
 *     summary: Get saved services
 *     tags: [Customer]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *     responses:
 *       200:
 *         description: List of saved services
 */
export async function getSavedServices(req, res) {
    try {
        const customerId = req.query.id;
        if (!customerId) {
            return res.status(400).json({ message: "Customer ID is required" });
        }
        const services = await SavedService.find({ customerId: customerId }).populate('serviceId');
        if (!services || services.length === 0) {
            return res.status(200).json({ success: true, message: "No saved services found!", data: [] });
        }
        res.status(200).json({ success: true, message: "Saved services fetched successfully", data: services });
    } catch (error) {
        console.error("Error Fetching saved Services:", error);
        res.status(500).json({ message: "Error fetching saved services" });
    }
}

/**
 * @swagger
 * /customer/unsave-service:
 *   delete:
 *     summary: Unsave a service
 *     tags: [Customer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - savedServiceId
 *             properties:
 *               customerId:
 *                 type: string
 *               savedServiceId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Service unsaved successfully
 */
export async function unsaveService(req, res) {
    try {
        const { customerId, savedServiceId } = req.body;
        const service = await SavedService.findOneAndDelete({ customerId: customerId, serviceId: savedServiceId });
        if (!service) {
            return res.status(404).json({ message: "Service not found" });
        }
        res.status(200).json({ message: "Service unsaved successfully" });
    } catch (error) {
        console.error("Error unsaving service:", error);
        res.status(500).json({ message: "Error unsaving service" });
    }

}


/**
 * @swagger
 * /public/providers/featured:
 *   get:
 *     summary: Get featured providers
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: List of featured providers
 */
export async function getFeaturedProviders(req, res) {
    try {
        // Assuming 'isFeatured' is a field in ServiceProvider schema
        // If not, we might just return top rated ones or random ones for now
        // Checking schemas.js, ServiceProvider has isFeatured!
        const providers = await ServiceProvider.find({ isFeatured: true, isVerified: true }).limit(6);

        // Map to simpler structure if needed, or return as is
        // Dashboard expects: name, service, rating, jobs
        // We might need to join with services to get "service" type 
        // For now let's just return the provider details
        res.status(200).json({ success: true, providers: providers });
    } catch (error) {
        console.error("Error fetching featured providers:", error);
        res.status(500).json({ message: "Error fetching featured providers" });
    }
}





