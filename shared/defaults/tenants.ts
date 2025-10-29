import { TenantInfo } from "../types/tenant";

export const defaultTenantConfig = {
  name: "Default Organization",
  slug: "default",
  domain: "localhost",
  settings: {
    theme: "default",
    features: {
      statemachine: true,
      notifications: true,
    },
  },
};

export const demoTenantConfig = {
  name: "Demo Organization",
  slug: "demo",
  domain: "localhost",
  settings: {
    theme: "default",
    features: {
      statemachine: true,
      notifications: true,
    },
  },
};

export const goodfellowTenantConfig = {
  name: "GoodFellow Organization",
  slug: "demo",
  domain: "demo.kenacloanmatrix.com",
  settings: {
    theme: "default",
    features: {
      statemachine: true,
      notifications: true,
    },
  },
};

export const allTenantConfigs = [
  defaultTenantConfig,
  demoTenantConfig,
  goodfellowTenantConfig,
];
