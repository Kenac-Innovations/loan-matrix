import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { useThemeColors } from "@/lib/theme-utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// New office schema
const officeSchema = z.object({
  name: z.string().min(1, "Office name is required"),
  code: z.string().min(1, "Office code is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email address").optional(),
});

type OfficeFormValues = z.infer<typeof officeSchema>;

interface AddOfficeDialogProps {
  setIsAddingNew: React.Dispatch<React.SetStateAction<boolean>>;
  isAddingNew: boolean;
  setShowAddOfficeDialog: React.Dispatch<React.SetStateAction<boolean>>;
  setOffices: React.Dispatch<React.SetStateAction<any[]>>;
  offices: any[];
  form: any; // Assuming this is a form object from a parent component
}

export function AddOfficeDialog({
  setIsAddingNew,
  isAddingNew,
  setShowAddOfficeDialog,
  setOffices,
  offices,
  form,
}: AddOfficeDialogProps) {
  const colors = useThemeColors();
  // Office form
  const officeForm = useForm<OfficeFormValues>({
    resolver: zodResolver(officeSchema) as any,
    defaultValues: {
      name: "",
      code: "",
      address: "",
      phone: "",
      email: "",
    },
  });

  // Handle adding new office
  const handleAddOffice = async (data: OfficeFormValues) => {
    setIsAddingNew(true);
    try {
      // In a real implementation, this would call the API to add a new office
      // For now, we'll simulate adding a new office
      // const result = await addOffice(data as any);

      // Simulate a successful response
      const mockResult = {
        success: true,
        id: Math.floor(Math.random() * 1000) + 100, // Generate a random ID
        name: data.name,
        description: null,
      };

      toast({
        title: "Success",
        description: "Office added successfully",
        variant: "default",
      });

      // Add the new office to the local state
      setOffices([...offices, mockResult]);

      // Select the new office
      form.setValue("officeId", mockResult.id);

      // Close dialog and reset form
      setShowAddOfficeDialog(false);
      officeForm.reset();
    } catch (error) {
      console.error("Error adding office:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsAddingNew(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card
        className={`w-full max-w-md border-${colors.borderColor} ${colors.cardBg}`}
      >
        <CardHeader>
          <CardTitle className={colors.textColor}>Add New Office</CardTitle>
          <CardDescription className={colors.textColorMuted}>
            Enter the details of the new office.
          </CardDescription>
        </CardHeader>
        <form onSubmit={officeForm.handleSubmit(handleAddOffice)}>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="name" className={colors.textColor}>
                  Office Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Enter office name"
                  className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                  {...officeForm.register("name")}
                />
                {officeForm.formState.errors.name && (
                  <p className="text-sm text-red-500">
                    {officeForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="code" className={colors.textColor}>
                  Office Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="code"
                  placeholder="Enter office code"
                  className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                  {...officeForm.register("code")}
                />
                {officeForm.formState.errors.code && (
                  <p className="text-sm text-red-500">
                    {officeForm.formState.errors.code.message}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="address" className={colors.textColor}>
                  Address
                </Label>
                <Input
                  id="address"
                  placeholder="Enter office address"
                  className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                  {...officeForm.register("address")}
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="phone" className={colors.textColor}>
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  placeholder="Enter phone number"
                  className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                  {...officeForm.register("phone")}
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="email" className={colors.textColor}>
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                  {...officeForm.register("email")}
                />
                {officeForm.formState.errors.email && (
                  <p className="text-sm text-red-500">
                    {officeForm.formState.errors.email.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddOfficeDialog(false)}
              className={`border-${colors.borderColor} hover:bg-${colors.hoverBgColor}`}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600"
              disabled={isAddingNew}
            >
              {isAddingNew ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Office"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
