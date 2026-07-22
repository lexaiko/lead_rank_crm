-- AlterTable
ALTER TABLE `chatmessage` ADD COLUMN `media_mime` VARCHAR(50) NULL,
    ADD COLUMN `media_path` VARCHAR(255) NULL,
    ADD COLUMN `media_type` VARCHAR(20) NULL;
