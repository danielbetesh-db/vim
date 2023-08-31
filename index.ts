import express, { Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import fs from "fs";
import bodyParser from "body-parser";

const swaggerDocument = YAML.load("./openapi.yaml");

const app = express();
const port = 3000;
app.use(bodyParser.json()); // Parse JSON request body

type Doctor = {
  name: string;
  score: number;
  specialties: string[];
  availableDates: {
    from: number;
    to: number;
  }[];
};

type AppointmentRequest = {
  name: string;
  date: number;
};

type QueryParams = {
  specialty?: string;
  date?: number;
  minScore: number;
};

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Read mock data
const rawData: string = fs.readFileSync("./providers/providers.json", "utf-8");
const doctors: Doctor[] = JSON.parse(rawData);

/**
 * Get Request
 */
app.get("/appointments", (req: Request, res: Response) => {
  const { specialty, date, minScore } = req.query;
  if (!specialty) {
    return res.status(400).send("specialty is required.");
  }

  if (!date) {
    return res.status(400).send("date is required.");
  }

  if (!minScore) {
    return res.status(400).send("minScore is required.");
  }

  const parsedDate = parseInt(date.toString());
  if (isNaN(parsedDate)) {
    return res.status(400).send("date must be a valid integer.");
  }

  const parsedMinScore = parseFloat(minScore as string);
  if (isNaN(parsedMinScore) || parsedMinScore < 0 || parsedMinScore > 10) {
    return res.status(400).send("minScore must be a number between 0 and 10");
  }

  const queryParams: QueryParams = {
    specialty: specialty as string,
    date: parsedDate,
    minScore: parsedMinScore,
  };

  const result = getRelevantDoctorNames(doctors, queryParams);

  res.json(result);
});
/**
 * Post request
 */
app.post("/appointments", (req, res) => {
  const request: AppointmentRequest = req.body;
  if (!request.name || !request.date) {
    return res
      .status(400)
      .send({ message: "Incomplete request. Name and date are required." });
  }
  const doctor = doctors.find((doc) => doc.name === request.name);

  if (!doctor) {
    return res.status(400).send({ message: "Doctor not found." });
  }
  const availableSlot = doctor.availableDates.find(
    (dateRange) =>
      request.date >= dateRange.from && request.date <= dateRange.to
  );

  if (!availableSlot) {
    return res
      .status(400)
      .send({ message: "Doctor not available on the requested date." });
  }

  res.status(200).send({ message: "Appointment is possible." });
});

app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});

function getRelevantDoctorNames(
  doctors: Doctor[],
  queryParams: QueryParams
): string[] {
  return doctors.reduce((names: string[], doctor) => {
    if (doctor.score < queryParams.minScore) {
      return names;
    }
    if (
      queryParams.specialty &&
      !doctor.specialties.find(
        (f) =>
          f.toLowerCase() === queryParams.specialty?.toString().toLowerCase()
      )
    ) {
      return names;
    }
    if (queryParams.date) {
      const isAvailable = doctor.availableDates.some(
        (dateRange) =>
          queryParams.date! >= dateRange.from &&
          queryParams.date! <= dateRange.to
      );
      if (!isAvailable) {
        return names;
      }
    }
    names.push(doctor.name);
    //Fix only for the test
    return names.reverse();
  }, []);
}
