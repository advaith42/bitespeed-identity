import { Request, Response } from "express";
import { PrismaClient, Contact, LinkPrecedence } from "@prisma/client";

const prisma = new PrismaClient();

export async function identifyContact(req: Request, res: Response): Promise<void> {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    res.status(400).json({ error: "At least one of email or phoneNumber is required" });
    return;
  }

  const emailVal: string | null = email ?? null;
  const phoneVal: string | null = phoneNumber ? String(phoneNumber) : null;

  try {
    const matchingContacts = await prisma.contact.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(emailVal ? [{ email: emailVal }] : []),
          ...(phoneVal ? [{ phoneNumber: phoneVal }] : []),
        ],
      },
    });

    if (matchingContacts.length === 0) {
      const newContact = await prisma.contact.create({
        data: {
          email: emailVal,
          phoneNumber: phoneVal,
          linkPrecedence: LinkPrecedence.primary,
        },
      });

      res.json({
        contact: {
          primaryContatctId: newContact.id,
          emails: newContact.email ? [newContact.email] : [],
          phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
          secondaryContactIds: [],
        },
      });
      return;
    }

    const primaryIds = new Set<number>();
    for (const contact of matchingContacts) {
      if (contact.linkPrecedence === LinkPrecedence.primary) {
        primaryIds.add(contact.id);
      } else if (contact.linkedId) {
        primaryIds.add(contact.linkedId);
      }
    }

    const allPrimaries = await prisma.contact.findMany({
      where: {
        id: { in: Array.from(primaryIds) },
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });

    const truePrimary = allPrimaries[0];

    if (allPrimaries.length > 1) {
      const toDegrade = allPrimaries.slice(1);
      for (const p of toDegrade) {
        await prisma.contact.update({
          where: { id: p.id },
          data: {
            linkPrecedence: LinkPrecedence.secondary,
            linkedId: truePrimary.id,
            updatedAt: new Date(),
          },
        });
        await prisma.contact.updateMany({
          where: {
            linkedId: p.id,
            deletedAt: null,
          },
          data: {
            linkedId: truePrimary.id,
            updatedAt: new Date(),
          },
        });
      }
    }

    const allSecondaries = await prisma.contact.findMany({
      where: {
        linkedId: truePrimary.id,
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });

    const allInCluster: Contact[] = [truePrimary, ...allSecondaries];

    const existingEmails = new Set(allInCluster.map((c) => c.email).filter(Boolean));
    const existingPhones = new Set(allInCluster.map((c) => c.phoneNumber).filter(Boolean));

    const isNewEmail = emailVal && !existingEmails.has(emailVal);
    const isNewPhone = phoneVal && !existingPhones.has(phoneVal);

    if (isNewEmail || isNewPhone) {
      const newSecondary = await prisma.contact.create({
        data: {
          email: emailVal,
          phoneNumber: phoneVal,
          linkedId: truePrimary.id,
          linkPrecedence: LinkPrecedence.secondary,
        },
      });
      allSecondaries.push(newSecondary);
    }

    const emails: string[] = [];
    const phoneNumbers: string[] = [];
    const secondaryContactIds: number[] = [];

    if (truePrimary.email) emails.push(truePrimary.email);
    if (truePrimary.phoneNumber) phoneNumbers.push(truePrimary.phoneNumber);

    for (const sec of allSecondaries) {
      if (sec.email && !emails.includes(sec.email)) emails.push(sec.email);
      if (sec.phoneNumber && !phoneNumbers.includes(sec.phoneNumber)) phoneNumbers.push(sec.phoneNumber);
      secondaryContactIds.push(sec.id);
    }

    res.json({
      contact: {
        primaryContatctId: truePrimary.id,
        emails,
        phoneNumbers,
        secondaryContactIds,
      },
    });
  } catch (error) {
    console.error("Error in /identify:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}