import { TenantInfo, DEFAULT_FEATURES } from "../types/tenant";

export const defaultTenantConfig = {
  name: "Default Organization",
  slug: "default",
  domain: "localhost",
  settings: {
    theme: "default",
    features: { ...DEFAULT_FEATURES },
  },
};

export const demoTenantConfig = {
  name: "Demo Organization",
  slug: "demo",
  domain: "localhost",
  settings: {
    theme: "default",
    features: { ...DEFAULT_FEATURES },
  },
};

export const goodfellowTenantConfig = {
  name: "GoodFellow Organization",
  slug: "goodfellow",
  domain: "goodfellow.kenacloanmatrix.com",
  settings: {
    theme: "default",
    features: { ...DEFAULT_FEATURES },
  },
};

export const omamaTrainingTenantConfig = {
  name: "Omama Training",
  slug: "omama-training",
  domain: "omama-training.kenacloanmatrix.com",
  settings: {
    theme: "default",
    features: { ...DEFAULT_FEATURES },
  },
};

export const allTenantConfigs = [
  defaultTenantConfig,
  demoTenantConfig,
  goodfellowTenantConfig,
  omamaTrainingTenantConfig,
];
