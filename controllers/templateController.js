import prisma from '../prisma/prismaClient.js';
import Joi from 'joi';

const templateSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  subject: Joi.string().min(3).max(200).required(),
  html_content: Joi.string().min(10).required(),
});

export const createTemplate = async (req, res) => {
  try {
    // 1. Validate the request body against our schema.
    const { error, value } = templateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // 2. Create the template in the database, associating it with the user.
    const template = await prisma.emailTemplate.create({
      data: {
        name: value.name,
        subject: value.subject,
        html_content: value.html_content,
        user_id: req.user.id, // req.user is securely provided by our authenticateJWT middleware
      },
    });

    res.status(201).json(template); // Use 201 Created for successful resource creation.
  } catch (err) {
    console.error('Failed to create template:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

export const getTemplates = async (req, res) => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' },
    });
    res.json(templates);
  } catch (err) {
    console.error('Failed to fetch templates:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Validate the request body.
    const { error, value } = templateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // 2. Perform the update.
    // We use `updateMany` with a `where` clause that includes the user_id.
    // This is a crucial security step: it ensures a user can ONLY update their own templates.
    const result = await prisma.emailTemplate.updateMany({
      where: {
        id: id,
        user_id: req.user.id, // Ensures user owns this template
      },
      data: {
        name: value.name,
        subject: value.subject,
        html_content: value.html_content,
      },
    });

    // 3. Check if any record was actually updated.
    if (result.count === 0) {
      return res.status(404).json({ error: 'Template not found or you do not have permission to edit it.' });
    }

    res.json({ success: true, message: 'Template updated successfully.' });
  } catch (err) {
    console.error('Failed to update template:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};


export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    // Similar to update, we include user_id in the `where` clause for security.
    const result = await prisma.emailTemplate.deleteMany({
      where: {
        id: id,
        user_id: req.user.id,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Template not found or you do not have permission to delete it.' });
    }

    res.status(204).send(); // 204 No Content is the standard response for a successful deletion.
  } catch (err) {
    console.error('Failed to delete template:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};