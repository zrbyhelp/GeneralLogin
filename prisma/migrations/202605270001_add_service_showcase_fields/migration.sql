ALTER TABLE `ServiceApp`
  ADD COLUMN `displayTitle` VARCHAR(191) NULL,
  ADD COLUMN `shortIntro` TEXT NULL,
  ADD COLUMN `coverImageUrl` TEXT NULL,
  ADD COLUMN `videoUrl` TEXT NULL,
  ADD COLUMN `mediaType` VARCHAR(191) NOT NULL DEFAULT 'image',
  ADD COLUMN `tags` JSON NULL,
  ADD COLUMN `showcaseOrder` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `featured` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `ServiceApp_showcaseOrder_idx` ON `ServiceApp`(`showcaseOrder`);
CREATE INDEX `ServiceApp_featured_idx` ON `ServiceApp`(`featured`);
