# Hospitality IT Hub

Build a professional enterprise-grade Hotel IT Operations Management System for a hospitality company.

The application must be responsive, modern, fast, and suitable for desktop and mobile browsers.

Authentication:

- Authenticate users using Microsoft Active Directory (LDAP).

- Employees log in with their domain username and password.

- Role-based permissions:

  - Administrator

  - IT Manager

  - IT Supervisor

  - IT Engineer

  - Helpdesk

  - Department Manager

  - Employee

Main Modules:

1. Dashboard

- Asset statistics

- Ticket statistics

- Maintenance schedule

- Warranty expiration

- License expiration

- Recent activities

- Charts by department and asset type

2. Asset Inventory

Manage all IT assets including:

- PCs

- Laptops

- Servers

- Printers

- Switches

- Firewalls

- Routers

- Access Points

- UPS

- NAS

- Phones

- Tablets

- TVs

- POS devices

- Scanners

Each asset should contain:

- Asset ID

- Barcode

- QR Code

- Asset Tag

- Serial Number

- Manufacturer

- Model

- CPU

- RAM

- Storage

- GPU

- Operating System

- Windows Version

- Office Version

- Hostname

- IP Address

- MAC Address

- Active Directory Computer Name

- Warranty Start

- Warranty End

- Purchase Date

- Purchase Cost

- Vendor

- Invoice Number

- Status

- Assigned User

- Department

- Building

- Floor

- Room

- Notes

- Photos

- Documents

- Asset movement history

3. Software Inventory

Track software installations and licenses:

- Software Name

- Version

- Vendor

- License Type

- License Key

- Expiration Date

- Number of Seats

- Assigned Devices

- Support Contact

- Documents

4. Network Inventory

Track:

- Switches

- Firewalls

- Routers

- Wireless Controllers

- Access Points

- Internet Links

Include:

- IP Address

- Firmware

- Configuration Backup

- Rack

- Location

- Warranty

- Support Information

5. Server Management

Manage physical and virtual servers:

- VMware

- Hyper-V

- Proxmox

Store:

- CPU

- RAM

- Storage

- Virtual Machines

- Backup Status

- Cluster

- Snapshots

- Operating System

- Purpose

6. Help Desk

Employees can submit tickets after logging in using Active Directory.

Ticket features:

- Title

- Description

- Category

- Department

- Priority

- Status

- Assigned Engineer

- Attachments

- Comments

- Resolution

- SLA

- Timeline

7. Preventive Maintenance

Recurring maintenance schedules:

- Daily

- Weekly

- Monthly

- Quarterly

- Yearly

Support automatic reminders.

8. Knowledge Base

Store SOPs, troubleshooting guides, vendor contacts, network diagrams, recovery procedures, and documentation.

9. Reports

Generate PDF and Excel reports for:

- Inventory

- Tickets

- Warranty

- Licenses

- Maintenance

- Asset movement

- Department statistics

10. Notifications

Send email and in-app notifications for:

- New tickets

- Warranty expiry

- License expiry

- Maintenance due

- Asset assignment

General Requirements:

- Responsive UI

- Professional hospitality theme

- Dark and light modes

- Advanced search

- Filters

- Global search

- Audit logs

- Activity history

- Dashboard analytics

- QR code generation

- Barcode printing

- Import and export using Excel

- Bulk asset updates

- Attachment uploads

- Automatic asset numbering

- Full CRUD functionality

- PostgreSQL database with normalized schema

- Clean REST API

- Secure authentication and authorization

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sonesta-care.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a2da120c-d276-42ff-bba8-ec4eea295a63).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
