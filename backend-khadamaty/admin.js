import { Customer, ServiceProvider, Service, Request, SavedService, Admin } from "./schemas.js";
import { transporter } from "./provider.js";


export async function getAllCustomers(req, res) {
    try {
        const customers = await Customer.find();
        res.status(200).json({ success: true, message: "Customers recieved successfully", data: customers });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}



/**
 * @swagger
 * /admin/signin:
 *   post:
 *     summary: Admin Sign In
 *     tags: [Admin]
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
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
export async function signInAdmin(req, res) {
    try {
        const { email, password } = req.body;
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }
        if (admin.password !== password) {
            return res.status(401).json({ success: false, message: "Invalid password" });
        }
        res.status(200).json({ success: true, message: "Admin signed in successfully", data: admin });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * @swagger
 * /admin/service-providers:
 *   get:
 *     summary: Get all service providers
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of all service providers
 */
export async function getAllServiceProviders(req, res) {
    try {
        const serviceProviders = await ServiceProvider.find();
        res.status(200).json({ success: true, message: "ServiceProviders recieved successfully", data: serviceProviders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * @swagger
 * /admin/services:
 *   get:
 *     summary: Get all services
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of all services
 */
export async function getAllServices(req, res) {
    try {
        const services = await Service.find();
        res.status(200).json({ success: true, message: "Services recieved successfully", data: services });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// Approve provider (set isVerified to true and isFeatured optionally)

/**
 * @swagger
 * /admin/providers/{providerId}/approve:
 *   post:
 *     summary: Approve a provider
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Provider approved
 */
export async function approveProvider(req, res) {
    try {
        const { providerId } = req.params;
        const { isFeatured } = req.body;
        const provider = await ServiceProvider.findByIdAndUpdate(
            providerId,
            { isApproved: true, isRejected: false, isFeatured: isFeatured ?? false, updatedAt: Date.now() },
            { new: true }
        );
        if (!provider) {
            return res.status(404).json({ success: false, message: "Provider not found" });
        }
        provider.isApproved = true;
        await provider.save();
        sendApprovalEmail(provider.email);
        res.status(200).json({ success: true, message: "Provider approved successfully", data: provider });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function sendApprovalEmail(email) {
    try {
        const mailOptions = {
            from: `"Khadamaty" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Your Provider Account has been Approved",
            html: `
            <div style="font-family: sans-serif; background-color: #f7f8fc; padding: 40px; text-align: center;">
                <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 24px; box-shadow: 0 20px 60px rgba(15, 27, 64, 0.08);">
                    <h1 style="color: #2a4dd0; margin-bottom: 24px; font-family: sans-serif;">Khadamaty</h1>
                    <p style="color: #4b5563; font-size: 16px; margin-bottom: 32px; line-height: 1.5;">
                        Your provider account has been approved. You can now start providing services to customers.
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
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

/**
 * @swagger
 * /admin/providers/{providerId}/reject:
 *   post:
 *     summary: Reject a provider
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Provider rejected
 */
export async function rejectProvider(req, res) {
    try {
        const { providerId } = req.params;
        const provider = await ServiceProvider.findByIdAndUpdate(
            providerId,
            { isApproved: false, isRejected: true, isFeatured: false, updatedAt: Date.now() },
            { new: true }
        );
        if (!provider) {
            return res.status(404).json({ success: false, message: "Provider not found" });
        }
        res.status(200).json({ success: true, message: "Provider rejected successfully", data: provider });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// Update provider status (for activation/suspension)

/**
 * @swagger
 * /admin/providers/{providerId}/status:
 *   patch:
 *     summary: Update provider status
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isVerified:
 *                 type: boolean
 *               isFeatured:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Status updated
 */
export async function updateProviderStatus(req, res) {
    try {
        const { providerId } = req.params;
        const { isVerified, isFeatured } = req.body;
        const updateData = { updatedAt: Date.now() };
        if (isVerified !== undefined) updateData.isVerified = isVerified;
        if (isFeatured !== undefined) updateData.isFeatured = isFeatured;

        const provider = await ServiceProvider.findByIdAndUpdate(providerId, updateData, { new: true });
        if (!provider) {
            return res.status(404).json({ success: false, message: "Provider not found" });
        }
        res.status(200).json({ success: true, message: "Provider status updated successfully", data: provider });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// Get all admins

/**
 * @swagger
 * /admin/admins:
 *   get:
 *     summary: Get all admins
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of all admins
 */
export async function getAllAdmins(req, res) {
    try {
        const admins = await Admin.find();
        res.status(200).json({ success: true, message: "Admins received successfully", data: admins });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * @swagger
 * /admin/admins/{adminId}/role:
 *   patch:
 *     summary: Update admin role
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: Role updated
 */
export async function updateAdminRole(req, res) {
    try {
        const { adminId } = req.params;
        const { role } = req.body;
        // Note: Admin schema doesn't have role field yet, but we'll add it for future use
        const admin = await Admin.findByIdAndUpdate(
            adminId,
            { role, updatedAt: Date.now() },
            { new: true }
        );
        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }
        res.status(200).json({ success: true, message: "Admin role updated successfully", data: admin });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}


/**
 * @swagger
 * /admin/providers/pending:
 *   get:
 *     summary: Get pending providers (Admin)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of pending providers
 */
export async function getPendingProviders(req, res) {
    try {
        const providers = await ServiceProvider.find({ isApproved: false, isRejected: false });
        res.status(200).json({ success: true, message: "Pending providers received successfully", data: providers });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}