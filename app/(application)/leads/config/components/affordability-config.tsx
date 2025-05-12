"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Info, PenSquare, Plus, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

// Affordability model types
type AffordabilityModel = {
  id: string;
  name: string;
  description: string;
  type: "dti" | "disposableIncome" | "employerBased" | "expenditureEstimation";
  isActive: boolean;
  isDefault: boolean;
  config: Record<string, any>;
};

export function AffordabilityConfig() {
  const [activeTab, setActiveTab] = useState("models");
  const [editingModel, setEditingModel] = useState<AffordabilityModel | null>(
    null
  );
  const [models, setModels] = useState<AffordabilityModel[]>([
    {
      id: "1",
      name: "Standard DTI Model",
      description: "Evaluates loan affordability based on debt-to-income ratio",
      type: "dti",
      isActive: true,
      isDefault: true,
      config: {
        maxDtiRatio: 0.43,
        warningDtiRatio: 0.36,
        includeMortgage: true,
        includeExistingLoans: true,
        includeProposedLoan: true,
        includeMinimumCreditCardPayments: true,
        includeAutoLoans: true,
        includeStudentLoans: true,
      },
    },
    {
      id: "2",
      name: "Net Disposable Income",
      description:
        "Evaluates if customer has sufficient funds left after expenses",
      type: "disposableIncome",
      isActive: true,
      isDefault: false,
      config: {
        minDisposableIncome: 500,
        disposableIncomePercentage: 0.3,
        includeBasicNeeds: true,
        includeTransportation: true,
        includeUtilities: true,
        includeEducation: true,
        includeHealthcare: true,
      },
    },
    {
      id: "3",
      name: "Employer-Based Assessment",
      description: "Uses salary multipliers based on employer category",
      type: "employerBased",
      isActive: false,
      isDefault: false,
      config: {
        governmentMultiplier: 5,
        corporateMultiplier: 4.5,
        smeMultiplier: 4,
        startupMultiplier: 3,
        selfEmployedMultiplier: 3,
        maxTermYears: 5,
        minEmploymentYears: 2,
      },
    },
    {
      id: "4",
      name: "Expenditure Estimation",
      description:
        "Estimates expenditure based on income brackets and location",
      type: "expenditureEstimation",
      isActive: false,
      isDefault: false,
      config: {
        estimationMethod: "percentage",
        lowerIncomePercentage: 0.7,
        middleIncomePercentage: 0.6,
        upperIncomePercentage: 0.5,
        lowerIncomeThreshold: 3000,
        upperIncomeThreshold: 8000,
        urbanAdjustmentFactor: 1.2,
        ruralAdjustmentFactor: 0.9,
      },
    },
  ]);

  // Add new model
  const addNewModel = () => {
    const newModel: AffordabilityModel = {
      id: Date.now().toString(),
      name: "New Affordability Model",
      description: "Description of the new affordability model",
      type: "dti",
      isActive: false,
      isDefault: false,
      config: {
        maxDtiRatio: 0.43,
        warningDtiRatio: 0.36,
      },
    };
    setModels([...models, newModel]);
    setEditingModel(newModel);
    setActiveTab("edit");
  };

  // Delete model
  const deleteModel = (id: string) => {
    setModels(models.filter((model) => model.id !== id));
    if (editingModel?.id === id) {
      setEditingModel(null);
    }
  };

  // Edit model
  const editModel = (model: AffordabilityModel) => {
    setEditingModel(model);
    setActiveTab("edit");
  };

  // Update model
  const updateModel = () => {
    if (!editingModel) return;

    setModels(
      models.map((model) =>
        model.id === editingModel.id ? editingModel : model
      )
    );
    setActiveTab("models");
    setEditingModel(null);
  };

  // Set default model
  const setDefaultModel = (id: string) => {
    setModels(
      models.map((model) => ({
        ...model,
        isDefault: model.id === id,
      }))
    );
  };

  // Toggle model active state
  const toggleModelActive = (id: string) => {
    setModels(
      models.map((model) =>
        model.id === id
          ? {
              ...model,
              isActive: !model.isActive,
            }
          : model
      )
    );
  };

  // Helper function to render model configuration based on type
  const renderModelConfig = () => {
    if (!editingModel) return null;

    switch (editingModel.type) {
      case "dti":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">
              Debt-to-Income Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxDtiRatio" className="text-gray-300">
                  Maximum DTI Ratio
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="maxDtiRatio"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={editingModel.config.maxDtiRatio}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        config: {
                          ...editingModel.config,
                          maxDtiRatio: Number.parseFloat(e.target.value),
                        },
                      })
                    }
                    className="bg-[#1a2035] border-[#2a304d] text-white"
                  />
                  <span className="text-gray-400">
                    ({(editingModel.config.maxDtiRatio * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="warningDtiRatio" className="text-gray-300">
                  Warning DTI Ratio
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="warningDtiRatio"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={editingModel.config.warningDtiRatio}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        config: {
                          ...editingModel.config,
                          warningDtiRatio: Number.parseFloat(e.target.value),
                        },
                      })
                    }
                    className="bg-[#1a2035] border-[#2a304d] text-white"
                  />
                  <span className="text-gray-400">
                    ({(editingModel.config.warningDtiRatio * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            </div>

            <h4 className="text-md font-medium text-gray-300 mt-4">
              Included Debt Types
            </h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeMortgage"
                  checked={editingModel.config.includeMortgage}
                  onCheckedChange={(checked) =>
                    setEditingModel({
                      ...editingModel,
                      config: {
                        ...editingModel.config,
                        includeMortgage: !!checked,
                      },
                    })
                  }
                  className="data-[state=checked]:bg-blue-600"
                />
                <Label htmlFor="includeMortgage" className="text-gray-300">
                  Include Mortgage/Rent
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeExistingLoans"
                  checked={editingModel.config.includeExistingLoans}
                  onCheckedChange={(checked) =>
                    setEditingModel({
                      ...editingModel,
                      config: {
                        ...editingModel.config,
                        includeExistingLoans: !!checked,
                      },
                    })
                  }
                  className="data-[state=checked]:bg-blue-600"
                />
                <Label htmlFor="includeExistingLoans" className="text-gray-300">
                  Include Existing Loans
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeProposedLoan"
                  checked={editingModel.config.includeProposedLoan}
                  onCheckedChange={(checked) =>
                    setEditingModel({
                      ...editingModel,
                      config: {
                        ...editingModel.config,
                        includeProposedLoan: !!checked,
                      },
                    })
                  }
                  className="data-[state=checked]:bg-blue-600"
                />
                <Label htmlFor="includeProposedLoan" className="text-gray-300">
                  Include Proposed Loan
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeMinimumCreditCardPayments"
                  checked={editingModel.config.includeMinimumCreditCardPayments}
                  onCheckedChange={(checked) =>
                    setEditingModel({
                      ...editingModel,
                      config: {
                        ...editingModel.config,
                        includeMinimumCreditCardPayments: !!checked,
                      },
                    })
                  }
                  className="data-[state=checked]:bg-blue-600"
                />
                <Label
                  htmlFor="includeMinimumCreditCardPayments"
                  className="text-gray-300"
                >
                  Include Minimum Credit Card Payments
                </Label>
              </div>
            </div>
          </div>
        );

      case "disposableIncome":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">
              Net Disposable Income Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minDisposableIncome" className="text-gray-300">
                  Minimum Disposable Income
                </Label>
                <div className="flex items-center">
                  <span className="mr-2 text-gray-400">$</span>
                  <Input
                    id="minDisposableIncome"
                    type="number"
                    min="0"
                    value={editingModel.config.minDisposableIncome}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        config: {
                          ...editingModel.config,
                          minDisposableIncome: Number.parseInt(e.target.value),
                        },
                      })
                    }
                    className="bg-[#1a2035] border-[#2a304d] text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="disposableIncomePercentage"
                  className="text-gray-300"
                >
                  Required Disposable Income (% of Income)
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="disposableIncomePercentage"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={editingModel.config.disposableIncomePercentage}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        config: {
                          ...editingModel.config,
                          disposableIncomePercentage: Number.parseFloat(
                            e.target.value
                          ),
                        },
                      })
                    }
                    className="bg-[#1a2035] border-[#2a304d] text-white"
                  />
                  <span className="text-gray-400">
                    (
                    {(
                      editingModel.config.disposableIncomePercentage * 100
                    ).toFixed(0)}
                    %)
                  </span>
                </div>
              </div>
            </div>

            <h4 className="text-md font-medium text-gray-300 mt-4">
              Included Expense Categories
            </h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeBasicNeeds"
                  checked={editingModel.config.includeBasicNeeds}
                  onCheckedChange={(checked) =>
                    setEditingModel({
                      ...editingModel,
                      config: {
                        ...editingModel.config,
                        includeBasicNeeds: !!checked,
                      },
                    })
                  }
                  className="data-[state=checked]:bg-blue-600"
                />
                <Label htmlFor="includeBasicNeeds" className="text-gray-300">
                  Include Basic Needs (Food, Clothing)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeTransportation"
                  checked={editingModel.config.includeTransportation}
                  onCheckedChange={(checked) =>
                    setEditingModel({
                      ...editingModel,
                      config: {
                        ...editingModel.config,
                        includeTransportation: !!checked,
                      },
                    })
                  }
                  className="data-[state=checked]:bg-blue-600"
                />
                <Label
                  htmlFor="includeTransportation"
                  className="text-gray-300"
                >
                  Include Transportation
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeUtilities"
                  checked={editingModel.config.includeUtilities}
                  onCheckedChange={(checked) =>
                    setEditingModel({
                      ...editingModel,
                      config: {
                        ...editingModel.config,
                        includeUtilities: !!checked,
                      },
                    })
                  }
                  className="data-[state=checked]:bg-blue-600"
                />
                <Label htmlFor="includeUtilities" className="text-gray-300">
                  Include Utilities (Water, Electricity, Internet)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeEducation"
                  checked={editingModel.config.includeEducation}
                  onCheckedChange={(checked) =>
                    setEditingModel({
                      ...editingModel,
                      config: {
                        ...editingModel.config,
                        includeEducation: !!checked,
                      },
                    })
                  }
                  className="data-[state=checked]:bg-blue-600"
                />
                <Label htmlFor="includeEducation" className="text-gray-300">
                  Include Education Expenses
                </Label>
              </div>
            </div>
          </div>
        );

      case "employerBased":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">
              Employer-Based Assessment Configuration
            </h3>
            <p className="text-gray-400 text-sm">
              Configure salary multipliers based on employer types to determine
              maximum loan amount
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="governmentMultiplier"
                    className="text-gray-300"
                  >
                    Government Employee Multiplier
                  </Label>
                  <Input
                    id="governmentMultiplier"
                    type="number"
                    min="0"
                    step="0.1"
                    value={editingModel.config.governmentMultiplier}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        config: {
                          ...editingModel.config,
                          governmentMultiplier: Number.parseFloat(
                            e.target.value
                          ),
                        },
                      })
                    }
                    className="bg-[#1a2035] border-[#2a304d] text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="corporateMultiplier"
                    className="text-gray-300"
                  >
                    Corporate Employee Multiplier
                  </Label>
                  <Input
                    id="corporateMultiplier"
                    type="number"
                    min="0"
                    step="0.1"
                    value={editingModel.config.corporateMultiplier}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        config: {
                          ...editingModel.config,
                          corporateMultiplier: Number.parseFloat(
                            e.target.value
                          ),
                        },
                      })
                    }
                    className="bg-[#1a2035] border-[#2a304d] text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smeMultiplier" className="text-gray-300">
                    SME Employee Multiplier
                  </Label>
                  <Input
                    id="smeMultiplier"
                    type="number"
                    min="0"
                    step="0.1"
                    value={editingModel.config.smeMultiplier}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        config: {
                          ...editingModel.config,
                          smeMultiplier: Number.parseFloat(e.target.value),
                        },
                      })
                    }
                    className="bg-[#1a2035] border-[#2a304d] text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="selfEmployedMultiplier"
                    className="text-gray-300"
                  >
                    Self-Employed Multiplier
                  </Label>
                  <Input
                    id="selfEmployedMultiplier"
                    type="number"
                    min="0"
                    step="0.1"
                    value={editingModel.config.selfEmployedMultiplier}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        config: {
                          ...editingModel.config,
                          selfEmployedMultiplier: Number.parseFloat(
                            e.target.value
                          ),
                        },
                      })
                    }
                    className="bg-[#1a2035] border-[#2a304d] text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#2a304d]">
                <div className="space-y-2">
                  <Label htmlFor="maxTermYears" className="text-gray-300">
                    Maximum Loan Term (Years)
                  </Label>
                  <Input
                    id="maxTermYears"
                    type="number"
                    min="1"
                    max="30"
                    value={editingModel.config.maxTermYears}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        config: {
                          ...editingModel.config,
                          maxTermYears: Number.parseInt(e.target.value),
                        },
                      })
                    }
                    className="bg-[#1a2035] border-[#2a304d] text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minEmploymentYears" className="text-gray-300">
                    Minimum Years of Employment
                  </Label>
                  <Input
                    id="minEmploymentYears"
                    type="number"
                    min="0"
                    value={editingModel.config.minEmploymentYears}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        config: {
                          ...editingModel.config,
                          minEmploymentYears: Number.parseInt(e.target.value),
                        },
                      })
                    }
                    className="bg-[#1a2035] border-[#2a304d] text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case "expenditureEstimation":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">
              Expenditure Estimation Configuration
            </h3>
            <p className="text-gray-400 text-sm">
              Configure expenditure estimation based on income brackets and
              location
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="estimationMethod" className="text-gray-300">
                  Estimation Method
                </Label>
                <Select
                  value={editingModel.config.estimationMethod}
                  onValueChange={(value) =>
                    setEditingModel({
                      ...editingModel,
                      config: {
                        ...editingModel.config,
                        estimationMethod: value,
                      },
                    })
                  }
                >
                  <SelectTrigger
                    id="estimationMethod"
                    className="bg-[#1a2035] border-[#2a304d] text-white"
                  >
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2035] border-[#2a304d] text-white">
                    <SelectItem
                      value="percentage"
                      className="focus:bg-[#2a304d] focus:text-white"
                    >
                      Percentage of Income
                    </SelectItem>
                    <SelectItem
                      value="fixed"
                      className="focus:bg-[#2a304d] focus:text-white"
                    >
                      Fixed Amount by Bracket
                    </SelectItem>
                    <SelectItem
                      value="hybrid"
                      className="focus:bg-[#2a304d] focus:text-white"
                    >
                      Hybrid (Fixed + Percentage)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="lowerIncomePercentage"
                    className="text-gray-300"
                  >
                    Lower Income Bracket %
                  </Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="lowerIncomePercentage"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={editingModel.config.lowerIncomePercentage}
                      onChange={(e) =>
                        setEditingModel({
                          ...editingModel,
                          config: {
                            ...editingModel.config,
                            lowerIncomePercentage: Number.parseFloat(
                              e.target.value
                            ),
                          },
                        })
                      }
                      className="bg-[#1a2035] border-[#2a304d] text-white"
                    />
                    <span className="text-gray-400">
                      (
                      {(
                        editingModel.config.lowerIncomePercentage * 100
                      ).toFixed(0)}
                      %)
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="middleIncomePercentage"
                    className="text-gray-300"
                  >
                    Middle Income Bracket %
                  </Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="middleIncomePercentage"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={editingModel.config.middleIncomePercentage}
                      onChange={(e) =>
                        setEditingModel({
                          ...editingModel,
                          config: {
                            ...editingModel.config,
                            middleIncomePercentage: Number.parseFloat(
                              e.target.value
                            ),
                          },
                        })
                      }
                      className="bg-[#1a2035] border-[#2a304d] text-white"
                    />
                    <span className="text-gray-400">
                      (
                      {(
                        editingModel.config.middleIncomePercentage * 100
                      ).toFixed(0)}
                      %)
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="upperIncomePercentage"
                    className="text-gray-300"
                  >
                    Upper Income Bracket %
                  </Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="upperIncomePercentage"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={editingModel.config.upperIncomePercentage}
                      onChange={(e) =>
                        setEditingModel({
                          ...editingModel,
                          config: {
                            ...editingModel.config,
                            upperIncomePercentage: Number.parseFloat(
                              e.target.value
                            ),
                          },
                        })
                      }
                      className="bg-[#1a2035] border-[#2a304d] text-white"
                    />
                    <span className="text-gray-400">
                      (
                      {(
                        editingModel.config.upperIncomePercentage * 100
                      ).toFixed(0)}
                      %)
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#2a304d]">
                <div className="space-y-2">
                  <Label
                    htmlFor="lowerIncomeThreshold"
                    className="text-gray-300"
                  >
                    Lower Income Threshold ($)
                  </Label>
                  <Input
                    id="lowerIncomeThreshold"
                    type="number"
                    min="0"
                    value={editingModel.config.lowerIncomeThreshold}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        config: {
                          ...editingModel.config,
                          lowerIncomeThreshold: Number.parseInt(e.target.value),
                        },
                      })
                    }
                    className="bg-[#1a2035] border-[#2a304d] text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="upperIncomeThreshold"
                    className="text-gray-300"
                  >
                    Upper Income Threshold ($)
                  </Label>
                  <Input
                    id="upperIncomeThreshold"
                    type="number"
                    min="0"
                    value={editingModel.config.upperIncomeThreshold}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        config: {
                          ...editingModel.config,
                          upperIncomeThreshold: Number.parseInt(e.target.value),
                        },
                      })
                    }
                    className="bg-[#1a2035] border-[#2a304d] text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#2a304d]">
                <div className="space-y-2">
                  <Label
                    htmlFor="urbanAdjustmentFactor"
                    className="text-gray-300"
                  >
                    Urban Location Adjustment Factor
                  </Label>
                  <Input
                    id="urbanAdjustmentFactor"
                    type="number"
                    min="0"
                    step="0.1"
                    value={editingModel.config.urbanAdjustmentFactor}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        config: {
                          ...editingModel.config,
                          urbanAdjustmentFactor: Number.parseFloat(
                            e.target.value
                          ),
                        },
                      })
                    }
                    className="bg-[#1a2035] border-[#2a304d] text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="ruralAdjustmentFactor"
                    className="text-gray-300"
                  >
                    Rural Location Adjustment Factor
                  </Label>
                  <Input
                    id="ruralAdjustmentFactor"
                    type="number"
                    min="0"
                    step="0.1"
                    value={editingModel.config.ruralAdjustmentFactor}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        config: {
                          ...editingModel.config,
                          ruralAdjustmentFactor: Number.parseFloat(
                            e.target.value
                          ),
                        },
                      })
                    }
                    className="bg-[#1a2035] border-[#2a304d] text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center p-8 text-gray-400">
            <Info className="h-12 w-12 mb-4" />
            <p>Please select an affordability model type to configure.</p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white">Affordability Models</h3>
        <p className="text-sm text-gray-400">
          Configure the affordability calculation models for loan applications
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="bg-[#0d121f] border border-[#1a2035]">
          <TabsTrigger
            value="models"
            className="data-[state=active]:bg-blue-500"
          >
            Affordability Models
          </TabsTrigger>
          <TabsTrigger
            value="edit"
            className="data-[state=active]:bg-blue-500"
            disabled={!editingModel}
          >
            {editingModel ? "Edit Model" : "Configuration"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="space-y-4">
          <Button
            onClick={addNewModel}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Model
          </Button>

          <div className="space-y-2">
            {models.map((model) => (
              <Card key={model.id} className="bg-[#0d121f] border-[#1a2035]">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-medium text-white">{model.name}</h3>
                        {model.isDefault && (
                          <Badge className="bg-blue-500 text-white">
                            Default
                          </Badge>
                        )}
                        {model.isActive ? (
                          <Badge className="bg-green-500 text-white">
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-500 text-white">
                            Inactive
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className="border-[#2a304d] text-gray-300"
                        >
                          {model.type === "dti" && "Debt-to-Income"}
                          {model.type === "disposableIncome" &&
                            "Net Disposable Income"}
                          {model.type === "employerBased" && "Employer-Based"}
                          {model.type === "expenditureEstimation" &&
                            "Expenditure Estimation"}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400">
                        {model.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!model.isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDefaultModel(model.id)}
                          className="border-[#2a304d] text-gray-300 hover:bg-[#2a304d] hover:text-white"
                        >
                          Set as Default
                        </Button>
                      )}
                      <Switch
                        checked={model.isActive}
                        onCheckedChange={() => toggleModelActive(model.id)}
                        className="data-[state=checked]:bg-green-500"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => editModel(model)}
                        className="text-gray-400 hover:text-white hover:bg-[#2a304d]"
                      >
                        <PenSquare className="h-4 w-4" />
                      </Button>
                      {!model.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteModel(model.id)}
                          className="text-gray-400 hover:text-white hover:bg-[#2a304d]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="edit">
          {editingModel ? (
            <Card className="bg-[#0d121f] border-[#1a2035]">
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="modelName" className="text-gray-300">
                      Model Name
                    </Label>
                    <Input
                      id="modelName"
                      value={editingModel.name}
                      onChange={(e) =>
                        setEditingModel({
                          ...editingModel,
                          name: e.target.value,
                        })
                      }
                      className="bg-[#1a2035] border-[#2a304d] text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="modelDescription" className="text-gray-300">
                      Description
                    </Label>
                    <Textarea
                      id="modelDescription"
                      value={editingModel.description}
                      onChange={(e) =>
                        setEditingModel({
                          ...editingModel,
                          description: e.target.value,
                        })
                      }
                      className="bg-[#1a2035] border-[#2a304d] text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="modelType" className="text-gray-300">
                      Model Type
                    </Label>
                    <Select
                      value={editingModel.type}
                      onValueChange={(
                        value:
                          | "dti"
                          | "disposableIncome"
                          | "employerBased"
                          | "expenditureEstimation"
                      ) => {
                        // Initialize config based on the selected type
                        let config = {};
                        switch (value) {
                          case "dti":
                            config = {
                              maxDtiRatio: 0.43,
                              warningDtiRatio: 0.36,
                              includeMortgage: true,
                              includeExistingLoans: true,
                              includeProposedLoan: true,
                              includeMinimumCreditCardPayments: true,
                            };
                            break;
                          case "disposableIncome":
                            config = {
                              minDisposableIncome: 500,
                              disposableIncomePercentage: 0.3,
                              includeBasicNeeds: true,
                              includeTransportation: true,
                              includeUtilities: true,
                            };
                            break;
                          case "employerBased":
                            config = {
                              governmentMultiplier: 5,
                              corporateMultiplier: 4.5,
                              smeMultiplier: 4,
                              selfEmployedMultiplier: 3,
                              maxTermYears: 5,
                              minEmploymentYears: 2,
                            };
                            break;
                          case "expenditureEstimation":
                            config = {
                              estimationMethod: "percentage",
                              lowerIncomePercentage: 0.7,
                              middleIncomePercentage: 0.6,
                              upperIncomePercentage: 0.5,
                              lowerIncomeThreshold: 3000,
                              upperIncomeThreshold: 8000,
                              urbanAdjustmentFactor: 1.2,
                              ruralAdjustmentFactor: 0.9,
                            };
                            break;
                        }

                        setEditingModel({
                          ...editingModel,
                          type: value,
                          config,
                        });
                      }}
                    >
                      <SelectTrigger
                        id="modelType"
                        className="bg-[#1a2035] border-[#2a304d] text-white"
                      >
                        <SelectValue placeholder="Select model type" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a2035] border-[#2a304d] text-white">
                        <SelectItem
                          value="dti"
                          className="focus:bg-[#2a304d] focus:text-white"
                        >
                          Debt-to-Income (DTI)
                        </SelectItem>
                        <SelectItem
                          value="disposableIncome"
                          className="focus:bg-[#2a304d] focus:text-white"
                        >
                          Net Disposable Income
                        </SelectItem>
                        <SelectItem
                          value="employerBased"
                          className="focus:bg-[#2a304d] focus:text-white"
                        >
                          Employer-Based
                        </SelectItem>
                        <SelectItem
                          value="expenditureEstimation"
                          className="focus:bg-[#2a304d] focus:text-white"
                        >
                          Expenditure Estimation
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isActive"
                        checked={editingModel.isActive}
                        onCheckedChange={(checked) =>
                          setEditingModel({
                            ...editingModel,
                            isActive: checked,
                          })
                        }
                        className="data-[state=checked]:bg-green-500"
                      />
                      <Label htmlFor="isActive" className="text-gray-300">
                        Active
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isDefault"
                        checked={editingModel.isDefault}
                        onCheckedChange={(checked) => {
                          // If setting to default, update all other models to not be default
                          if (checked) {
                            setModels(
                              models.map((m) => ({
                                ...m,
                                isDefault: m.id === editingModel.id,
                              }))
                            );
                          }
                          setEditingModel({
                            ...editingModel,
                            isDefault: checked,
                          });
                        }}
                        className="data-[state=checked]:bg-blue-500"
                      />
                      <Label htmlFor="isDefault" className="text-gray-300">
                        Default Model
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-[#2a304d]">
                  {renderModelConfig()}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingModel(null);
                      setActiveTab("models");
                    }}
                    className="border-[#2a304d] text-gray-300 hover:bg-[#2a304d] hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={updateModel}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Model
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center p-16">
              <Info className="h-16 w-16 text-gray-400 mb-4" />
              <p className="text-gray-400">
                Select a model to edit or create a new one
              </p>
              <Button
                onClick={addNewModel}
                variant="outline"
                className="mt-4 border-[#2a304d] text-gray-300 hover:bg-[#2a304d] hover:text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add New Model
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
