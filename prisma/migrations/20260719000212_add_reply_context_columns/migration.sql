-- AlterTable
ALTER TABLE `chatmessage` ADD COLUMN `reply_to_sender` VARCHAR(20) NULL,
    ADD COLUMN `reply_to_snippet` TEXT NULL,
    ADD COLUMN `reply_to_wa_id` VARCHAR(100) NULL;
