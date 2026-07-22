-- CreateTable
CREATE TABLE `GreetingRule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `keyword` VARCHAR(50) NOT NULL,
    `source` VARCHAR(50) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GreetingRule_keyword_key`(`keyword`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed default greeting rules (previously hardcoded)
INSERT INTO `GreetingRule` (`keyword`, `source`, `createdAt`, `updatedAt`) VALUES
    ('hola', 'tiktok', NOW(3), NOW(3)),
    ('hi', 'website', NOW(3), NOW(3)),
    ('halo', 'instagram', NOW(3), NOW(3));
