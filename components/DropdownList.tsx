'use client'
import Image from 'next/image'
import React, { useState } from 'react'

const DropdownList = () => {
  const [isOpen, setisOpen] = useState(false)
  
  return (
    <div className='relative'>
      <div className="cursor-pointer" onClick={() => setisOpen(!isOpen)}>
        <div className="filter-trigger">
          <figure>
            <Image
            src={'/../assets/icons/hamburger.svg'}
            alt='Filter Icon'
            width={14}  
            height={14}
            />
            Most Recent
          </figure>
          <Image src="/assets/icons/arrow-down.svg" alt="Arrow Down Icon" width={20} height={20} />
        </div>
      </div>

      {isOpen &&  (
        <ul className="dropdown">
          {['Most Recent', 'Most Liked'].map((option) => (
            <li key={option} className='list-item'> 
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default DropdownList  