import { PrismaClient } from "@prisma/client";
import { Response, Request } from "express";
import { addMinutes, subHours, addHours } from "date-fns";
import { ca, tr } from "date-fns/locale";
import { table } from "console";
const feature6Client = new PrismaClient();

// export const getfeature6 = async (req: Request, res: Response) => {

// };

//GET METHOD
export const getAllTable = async (req: Request, res: Response) => {
    try {
        const tables = await feature6Client.tables.findMany();
        return res.json(tables);
    } catch (e) {
        console.log(e);
        return res.status(500).json(e);
    }
};

export const getAllReservation = async (req: Request, res: Response) => {
    try {
        const reservations = await feature6Client.reservation.findMany();
        return res.json(reservations);
    } catch (e) {
        console.log(e);
        return res.status(500).json(e);
    }
};

//My Reservation
export const getAllReservationByStatus = async (
    req: Request,
    res: Response
) => {
    try {
        const { status, userId } = req.body;
        const Reservation = await feature6Client.reservation.findMany({
            where: {
                status: status,
                userId: userId,
            },
            include: {
                venue: {
                    include: {
                        Venue_photo: true,
                        Menu: {
                            select: {
                                price: true,
                            },
                            orderBy: {
                                price: "asc",
                            },
                            take: 1,
                        },
                    },
                },
                user: {
                    select: {
                        userId: true,
                        username: true,
                    },
                },
            },
        });

        return res.json(Reservation);
    } catch (e) {
        console.error(e);
        return res.status(500).json(e);
    }
};

export const getVenueById = async (req: Request, res: Response) => {
    try {
        const { venueId } = req.params;
        const venue = await feature6Client.venue.findUnique({
            where: {
                venueId: parseInt(venueId),
            },
            include: {
                // location: true,
                Venue_photo: true,
            },
        });
        return res.json(venue);
    } catch (e) {
        console.error(e);
        return res.status(500).json(e);
    }
};

export const getReservationById = async (req: Request, res: Response) => {
    try {
        const reservations = await feature6Client.reservation.findMany({
            where: {
                userId: parseInt(req.body.userId),
                reservationId: parseInt(req.params.reservationId),
            },
            include: {
                user: true,
                Deposit: {
                    select: {
                        deposit_amount: true,
                        status: true,
                        depositId: true,
                    },
                },
            },
        });
        return res.json(reservations);
    } catch (e) {
        console.log(e);
        return res.status(500).json(e);
    }
};

//POST METHOD

//อันนี้ ver1 ข้ามโลด
// export const createReservation = async (req: Request, res: Response) => {
//     try {
//         const { venueId, userId, guest_amount, reserved_time } = req.body;
//         const entry_time = addMinutes(new Date(reserved_time), -30);
//         const isTableAvailable = await isTableAvailableForReservation(
//             venueId,
//             reserved_time
//         );
//         if (!isTableAvailable) {
//             return res
//                 .status(400)
//                 .json({ error: "Table not available for the specified time." });
//         }
//         const reservation = await feature6Client.reservation.create({
//             data: {
//                 venueId: venueId,
//                 userId: userId,
//                 guest_amount: guest_amount,
//                 reserved_time: reserved_time,
//                 status: "Pending",
//                 entry_time: entry_time,
//             },
//         });
//         return res.json(reservation);
//     } catch (e) {
//         console.log(e);
//         return res.status(500).json(e);
//     }
// };

// Not finish yet เหลือเก็บทุก table ที่จองไว้ใน Reserve_Table 
// อันนี้ยัง error อยู่ ปิดไปจะหาย error
//มันยังเป็นแบบที่ 1 การจอง จองได้ 1 โต๊ะ
export const createReservation = async (req: Request, res: Response) => {
    try {
    const { venueId, userId, guest_amount, reserved_time } = req.body;
    // Use the previous functions to check availability and find a suitable table
    const reservedTimeStart = reserved_time;
    const reservedTimeEnd = reservedTimeStart.add({ hours: 3 }); // Assuming a reservation lasts for 3 hours
    const entry_time = addMinutes(new Date(reserved_time), -30);
  
    const availableTables = await getAvailableTables(reservedTimeStart, reservedTimeEnd);
    const selectedTable = findSuitableTable(availableTables, guest_amount);
  
    if (!selectedTable) {
      throw new Error('No suitable tables available.');
    }
  
    // Create the reservation
    const newReservation = await feature6Client.reservation.create({
      data: {
        userId,
        venueId,
        guest_amount: guest_amount,
        reserved_time: reservedTimeStart,
        entry_time: entry_time,
        status: 'Pending',
        tables: {
          connect: selectedTables.map((table) => ({ tableId: table.tableId })),
        },
      },
      include: {
        tables: true,
      },
    });
    // Create the reservation table entry
    await feature6Client.reservation_table.create({
      data: {
        amount: guest_amount,
        reserveId: newReservation.reservationId,
        tableId: selectedTable.tableId,
      },
    });
  
    res.status(200).json(newReservation);
  } catch (e) {
    console.log(e);
    return res.status(500).json(e);
  }
  
// function ที่หา reservation ในเวลาเดียวกับที่จะจองเพิ่ม
export const checkAvailability = async (req: Request, res: Response) => {
    try {
        const { venueId, reservedTimeStart, reservedTimeEnd } = req.body;
    
        // Query the database to find reservations within the specified time range
        const overlappingReservations = await feature6Client.reservation.findMany({
          where: {
            venueId,
            reserved_time: {
              gte: reservedTimeStart, // Greater than or equal to reservedTimeStart
              lte: reservedTimeEnd, // Less than or equal to reservedTimeEnd
            },
            status: {
              not: 'Cancel',
            },
          },
        }); 
    
        res.status(200).json({ overlappingReservations });
      } catch (e) {
        console.error('Error checking availability:', e);
        return res.status(500).json(e);
      }
  }


// waiting for revise DB then will try to map, Now stil error
export const getAvailableTables = async (res: Response, req: Request) => {
    const { venueId, reservedTimeStart, reservedTimeEnd } = req.body;

    // Calculate the preparation time start (3 hours before the reservation)
    const preparationTimeStart = addHours(new Date(reservedTimeStart), -3);
    // Use the checkAvailability function to get reserved tables during the specified time
    const overlappingReservations = await checkAvailability(reservedTimeStart, reservedTimeEnd);
  
    // Query all tables and filter out the reserved tables
    const allTables = await feature6Client.tables.findMany(
        {
            where: {
            venueId : venueId,
            },
        }
    );
    const reservedTableIds = overlappingReservations.map((reservation) => reservation.venueId);
  
    const availableTables = allTables.filter((table) => !reservedTableIds.includes(table.tableId));
  
    return availableTables;
  }
  
export const findSuitableTable = async (req: Request, res: Response) => {
    const { availableTables, guestAmount } = req.body;
    // Filter tables based on guest capacity
    const suitableTables = availableTables.filter((table) => table.venue.capacity >= guestAmount);
    const selectedTable = suitableTables[0]; // For simplicity, just selecting the first suitable table
    return selectedTable || null;
  }
  

//Create table still error

// export const createTable = async (req: Request, res: Response) => {
// try {
//     const { information, image_url, venueId } = req.body;
//     const newTableTypeDetail = await createTabletype(req, res) as { tableTypeDetailId: number };
//     const newTable = await feature6Client.tables.create({
//         data: {
//             information: information,
//             image_url: image_url,
//             tableTypeDetailId: newTableTypeDetail.tableTypeDetailId,
//             venueId: venueId,
//         },
//     });
//         return res.json(newTable);
// } catch (e) {
//         return res.status(500).json(e);
//     };
// };

// export const createTabletype = async (req: Request, res: Response) => {
//     try {
//      const { name, detail, capacity, venueId } = req.body;
//      const newTabletype = await feature6Client.table_type_detail.create({
//        data: {
//         name: name,
//         detail: detail,
//         capacity: capacity,
//         venueId: venueId,
//        },
//      });
//          return newTabletype;
//      } catch (e) {
//          console.log(e);
//          return res.status(500).json(e);
//      };
//  };