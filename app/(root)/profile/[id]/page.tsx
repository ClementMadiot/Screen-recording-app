import Header from "@/components/Header";
import React from "react";

const page = async ({ params }: ParamsWithSearch) => {
  const { id } = await params;
  return (
    <div className="wrapper page">
      <Header
        title="CM | Developer"
        subHeader="clement09@gmail.com"
        userImg="/assets/images/dummy.jpg"
      />
      <h1 className="text-2xl font-karla">USER ID : {id}</h1>
    </div>
  );
};

export default page;
